import json
import uuid
from typing import List, Dict
from flask import Blueprint, request, jsonify
from flask_babel import _, get_locale
from app.api.routes.generation import extract_visual_language, _generate_single_svg
from app.services.language_generation.gpt_generator import generate_visual_language
from app.services.tutor.gemini_tutor import (
    start_tutor_session,
    _generate_tutor_reply_stream,
    MAX_HISTORY,
)
from app.services.tutor.session_storage import get_session, save_session, delete_session
from app.services.tutor.dsl_container_types import apply_container_type_modifications
from app.utils.validation_constants import MWP_MAX_LENGTH, MESSAGE_MAX_LENGTH
from flask import Response, stream_with_context
import re

tutor_bp = Blueprint('tutor', __name__)

NEW_MWP_PATTERN = re.compile(r"^\s*NEW_MWP\s*\n?\s*MWP:\s*(.+)\s*$", re.DOTALL)

def _normalize_text_for_contains_check(text: str) -> str:
    """Normalize text for containment checks (casefold + collapse whitespace)."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip().casefold()


def _is_new_mwp_supported_by_last_student_message(extracted_mwp: str, history: List[Dict[str, str]]) -> bool:
    """
    Safeguard against hallucinated NEW_MWP: only accept if the extracted MWP text is contained
    in the most recent student message (after normalization).
    """
    mwp_norm = _normalize_text_for_contains_check(extracted_mwp)
    if not mwp_norm:
        return False
    last_student = next(
        (h.get("content") or "" for h in reversed(history) if h.get("role") == "student"),
        "",
    )
    student_norm = _normalize_text_for_contains_check(last_student)
    return mwp_norm in student_norm if student_norm else False


def _extract_new_mwp(text: str) -> str | None:
    """
    Extract a new math word problem from a NEW_MWP control message.
    Returns the extracted MWP if present, otherwise None.
    """
    if not text:
        return None
    stripped = text.lstrip()
    if not stripped.startswith("NEW_MWP"):
        return None
    match = NEW_MWP_PATTERN.match(stripped)
    if not match:
        return None
    mwp = (match.group(1) or "").strip()
    return mwp or None


def _create_tutor_stream_response(visual_language: str, history: List[Dict[str, str]], language: str, session_id: str = None):
    """
    Helper function to create a streaming response for tutor replies.
    Used by both start/stream and message/stream endpoints.
    """
    def event_stream():
        try:
            visual_request = None

            def _emit_chunk(delta: str):
                payload = {"type": "chunk", "delta": delta}
                return f"data: {json.dumps(payload)}\n\n"

            def _emit_done(final_text: str, visual):
                payload = {
                    "type": "done",
                    "session_id": session_id,
                    "tutor_message": final_text,
                    "visual": visual,
                }
                return f"data: {json.dumps(payload)}\n\n"

            def _emit_suppress_done():
                """
                End the stream without emitting a tutor message.
                The frontend should drop the placeholder bubble and stop streaming.
                """
                payload = {
                    "type": "done",
                    "session_id": session_id,
                    "tutor_message": "",
                    "visual": None,
                    "suppress_message": True,
                }
                return f"data: {json.dumps(payload)}\n\n"

            def _finalize_and_persist(final_text: str, vr: dict | None, current_vl: str):
                # Update history with visual request DSL if present
                tutor_entry = {"role": "tutor", "content": final_text}
                if vr:
                    tutor_entry["visual_request"] = vr
                history.append(tutor_entry)

                # Update session if session_id provided
                if session_id:
                    truncated_history = history[-MAX_HISTORY:]
                    save_session(session_id, current_vl, truncated_history)

            def _stream_reply_events(current_vl: str):
                """
                Stream model output and yield SSE chunk events.
                Suppresses NEW_MWP control messages from being sent to the client.

                Returns: (mode, final_text, visual_request)
                  - mode: "normal" | "new_mwp"
                """
                buffered = ""
                mode = None  # None=undecided, "normal", "new_mwp"
                last_visual_request = None

                for chunk in _generate_tutor_reply_stream(current_vl, history, language):
                    if not (isinstance(chunk, dict) and chunk.get("__done__")):
                        delta = chunk or ""
                        if mode is None:
                            buffered += delta
                            stripped = buffered.lstrip()
                            if stripped.startswith("NEW_MWP"):
                                if len(stripped) >= len("NEW_MWP"):
                                    mode = "new_mwp"
                                    continue
                            else:
                                if stripped:
                                    mode = "normal"
                                    yield _emit_chunk(buffered)
                                    buffered = ""
                        else:
                            if mode == "normal":
                                yield _emit_chunk(delta)
                        continue

                    final_text = chunk.get("full_text", "") or ""
                    last_visual_request = chunk.get("visual_request")
                    if mode is None:
                        stripped = final_text.lstrip()
                        mode = "new_mwp" if stripped.startswith("NEW_MWP") else "normal"
                    if mode == "normal" and buffered:
                        yield _emit_chunk(buffered)
                        buffered = ""
                    return mode, final_text, last_visual_request

                # Shouldn't happen, but keep behavior safe
                return "normal", "", last_visual_request

            mode, final_text, visual_request = yield from _stream_reply_events(visual_language)

            if mode == "new_mwp":
                mwp = _extract_new_mwp(final_text)
                # Safeguard against hallucinated NEW_MWP: only accept if it's contained in the last student message.
                if (not mwp) or (not _is_new_mwp_supported_by_last_student_message(mwp, history)):
                    yield _emit_suppress_done()
                    return

                vl_response = generate_visual_language(mwp, None, None, language=language)
                raw = extract_visual_language(vl_response)
                if not raw:
                    err_payload = {"type": "error", "error": _("Did not get Visual Language from AI. Please try again.")}
                    yield f"data: {json.dumps(err_payload)}\n\n"
                    return
                new_dsl = raw.split(":", 1)[1].strip() if raw.lower().startswith("visual_language:") else raw.strip()
                
                # Apply container type modifications to ensure consistent icon selection
                new_dsl = apply_container_type_modifications(new_dsl)

                # Reset conversation history to the new problem (keep session_id stable)
                history.clear()
                history.append({"role": "student", "content": mwp})
                if session_id:
                    delete_session(session_id)
                    save_session(session_id, new_dsl, history[-MAX_HISTORY:])

                new_mode, new_final_text, new_visual_request = yield from _stream_reply_events(new_dsl)
                if new_mode == "new_mwp":
                    err_payload = {"type": "error", "error": _("Could not start a new problem. Please try again.")}
                    yield f"data: {json.dumps(err_payload)}\n\n"
                    return

                _finalize_and_persist(new_final_text, new_visual_request, new_dsl)
                visual = _render_visual_request(new_visual_request, new_dsl, session_id=session_id)
                done_event = json.loads(_emit_done(new_final_text, visual)[6:])
                done_event["visual_language"] = new_dsl
                yield f"data: {json.dumps(done_event)}\n\n"
                return

            _finalize_and_persist(final_text, visual_request, visual_language)
            visual = _render_visual_request(visual_request, visual_language, session_id=session_id)
            yield _emit_done(final_text, visual)
            return
        except Exception as e:
            err_payload = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(err_payload)}\n\n"
    
    return event_stream


def _render_visual_request(visual_request: dict, fallback_dsl: str, session_id: str = None):
    if not visual_request:
        return None

    # Check if session has a preferred variant (from previous fallback)
    session = get_session(session_id) if session_id else None
    preferred_variant = session.get("preferred_variant") if session else None
    
    # Use preferred variant if available, otherwise use requested variant
    requested_variant = visual_request.get("variant") or "intuitive"
    variant = preferred_variant if preferred_variant else requested_variant
    
    dsl_scope = (visual_request.get("dsl_scope") or fallback_dsl or "").strip()

    if not dsl_scope:
        return {
            "variant": variant,
            "error": _("Missing DSL scope for visual request."),
        }

    # Try generating with the selected variant (preferred or requested)
    svg_content, error, _, is_parse_error = _generate_single_svg(dsl_scope, variant)
    
    # If generation failed (no SVG and not a parse error), try fallback to the other variant
    if not svg_content and not is_parse_error and error:
        fallback_variant = "intuitive" if variant == "formal" else "formal"
        fallback_svg, fallback_error, _, fallback_is_parse_error = _generate_single_svg(dsl_scope, fallback_variant)
        
        # If fallback succeeded, use it and store as preferred for this session
        if fallback_svg:
            # Remember this fallback variant for future requests in this session
            if session:
                # Update session with preferred variant
                visual_language = session.get("visual_language", fallback_dsl)
                history = session.get("history", [])
                save_session(session_id, visual_language, history, metadata={"preferred_variant": fallback_variant})
            
            return {
                "variant": fallback_variant,
                "svg": fallback_svg,
                "error": None,
                "is_parse_error": fallback_is_parse_error,
                "dsl_scope": dsl_scope
            }

    return {
        "variant": variant,
        "svg": svg_content,
        "error": error,
        "is_parse_error": is_parse_error,
        "dsl_scope": dsl_scope,
    }


@tutor_bp.route("/api/tutor/start", methods=["POST"])
def tutor_start():
    """
    Start a tutoring session for a math word problem.
    If MWP is provided, generates visual language first, then initializes the tutor conversation.
    If MWP is null/empty, creates a session without DSL generation (for autostart).
    """
    body = request.json or {}
    mwp = (body.get("mwp") or "").strip()
    language = get_locale()

    # If no MWP provided, create session without DSL (autostart mode)
    if not mwp:
        session_id = str(uuid.uuid4())
        empty_dsl = ""
        # Create session with empty history and empty visual_language
        save_session(session_id, empty_dsl, [])
        return jsonify({
            "session_id": session_id,
            "tutor_message": "",
            "visual_language": empty_dsl,
            "visual": None
        })

    # Generate visual language via GPT backend
    vl_response = generate_visual_language(mwp, None, None, language=language)
    raw = extract_visual_language(vl_response)
    if not raw:
        return jsonify({"error": _("Did not get Visual Language from AI. Please try again.")}), 500
    dsl = raw.split(":", 1)[1].strip() if raw.lower().startswith("visual_language:") else raw.strip()
    
    # Apply container type modifications to ensure consistent icon selection
    dsl = apply_container_type_modifications(dsl)

    session_id, tutor_reply, visual_request = start_tutor_session(mwp, dsl, language=str(language))
    visual = _render_visual_request(visual_request, dsl, session_id=session_id)

    return jsonify({
        "session_id": session_id,
        "tutor_message": tutor_reply,
        "visual_language": dsl,
        "visual": visual
    })


@tutor_bp.route("/api/tutor/start/stream", methods=["POST"])
def tutor_start_stream():
    """
    Start a tutoring session with streaming tutor response.
    If MWP is provided, generates visual language first, then streams the tutor conversation.
    If MWP is null/empty, creates a session without DSL generation (for autostart).
    """
    body = request.json or {}
    mwp = (body.get("mwp") or "").strip()
    language = get_locale()

    # Validate MWP length if provided
    if mwp and len(mwp) > MWP_MAX_LENGTH:
        err_payload = {"type": "error", "error": _("Math word problem is too long (max %(max)d characters).", max=MWP_MAX_LENGTH)}
        def error_stream():
            yield f"data: {json.dumps(err_payload)}\n\n"
        return Response(stream_with_context(error_stream()), mimetype="text/event-stream")

    # If no MWP provided, create session without DSL (autostart mode)
    if not mwp:
        session_id = str(uuid.uuid4())
        empty_dsl = ""
        history: List[Dict[str, str]] = []
        save_session(session_id, empty_dsl, history)
        # Return empty response for autostart
        def empty_stream():
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'tutor_message': '', 'visual_language': empty_dsl, 'visual': None})}\n\n"
        return Response(stream_with_context(empty_stream()), mimetype="text/event-stream")

    # Generate visual language via GPT backend
    vl_response = generate_visual_language(mwp, None, None, language=language)
    raw = extract_visual_language(vl_response)
    if not raw:
        return jsonify({"error": _("Did not get Visual Language from AI. Please try again.")}), 500
    dsl = raw.split(":", 1)[1].strip() if raw.lower().startswith("visual_language:") else raw.strip()
    
    # Apply container type modifications to ensure consistent icon selection
    dsl = apply_container_type_modifications(dsl)

    # Create session and get initial history
    session_id = str(uuid.uuid4())
    history: List[Dict[str, str]] = [{"role": "student", "content": mwp}]
    
    event_stream = _create_tutor_stream_response(dsl, history, str(language), session_id=session_id)
    
    # Add visual_language to done payload for start endpoint
    original_stream = event_stream
    def enhanced_stream():
        for event in original_stream():
            if event.startswith("data: "):
                try:
                    payload = json.loads(event[6:])
                    if payload.get("type") == "done":
                        payload["visual_language"] = dsl
                        yield f"data: {json.dumps(payload)}\n\n"
                        continue
                except:
                    pass
            yield event
    
    return Response(stream_with_context(enhanced_stream()), mimetype="text/event-stream")


@tutor_bp.route("/api/tutor/message/stream", methods=["POST"])
def tutor_message_stream():
    """
    Stream a tutoring response (text chunks) using SSE-like format.
    JSON body: session_id, message
    """
    body = request.get_json(silent=True) or {}
    session_id = (body.get("session_id") or "").strip()
    user_message = (body.get("message") or "").strip()

    if not session_id:
        return jsonify({"error": _("Missing session id.")}), 400
    if not user_message:
        return jsonify({"error": _("Please provide a message.")}), 400
    if len(user_message) > MESSAGE_MAX_LENGTH:
        return jsonify({"error": _("Message is too long (max %(max)d characters).", max=MESSAGE_MAX_LENGTH)}), 400

    session = get_session(session_id)
    if not session:
        return jsonify({"error": _("Session not found or expired.")}), 404

    visual_language = session.get("visual_language", "")
    # Always use language from request header
    language = str(get_locale())
    history: List[Dict[str, str]] = session.get("history", [])

    # Append user message to history before generation
    history.append({"role": "student", "content": user_message})

    event_stream = _create_tutor_stream_response(visual_language, history, language, session_id=session_id)
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


