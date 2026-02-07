"""
ChatGPT API routes for analytics mode chat interface.
Supports streaming text and images.
"""
import json
import uuid
import logging
import os
import requests
from typing import List, Dict, Optional
from io import BytesIO
from flask import Blueprint, request, jsonify, Response, stream_with_context, send_file
from flask_babel import _
from openai import OpenAI
from app.utils.validation_constants import MESSAGE_MAX_LENGTH
from app.services.chatgpt.session_storage import (
    get_chatgpt_session,
    save_chatgpt_session,
)
from app.services.validation.text_sanitizer import sanitize_tutor_message

logger = logging.getLogger(__name__)

chatgpt_bp = Blueprint('chatgpt', __name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def _generate_image_with_dalle(prompt: str) -> Optional[str]:
    """
    Generate an image using DALL-E 3 via OpenAI's images API.
    Returns the image URL or None if generation fails.
    """
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        if response.data:
            return response.data[0].url
    except Exception as e:
        logger.error(f"Error generating image with DALL-E 3: {e}")
    return None


def _create_chatgpt_stream_response(history: List[Dict], session_id: str):
    """
    Create a streaming response for ChatGPT replies.
    Supports text and images.
    Uses function calling to enable image generation.
    """
    def event_stream():
        try:
            # Convert history to OpenAI format
            messages = []
            for msg in history:
                role = "user" if msg.get("role") == "user" else "assistant"
                content = msg.get("content", "")
                
                # Skip tool messages in history - the final assistant response already
                # incorporates tool results, so tool messages are redundant for context.
                # Including them without complete tool_call sequences would cause API errors.
                if role == "tool":
                    continue
                
                # Content is always a string in current implementation (image uploads not yet implemented).
                # If image uploads are added later, content may be a list for multimodal messages.
                if isinstance(content, list):
                    message_dict = {"role": role, "content": content}
                else:
                    message_dict = {"role": role, "content": str(content)}
                
                # Don't include tool_calls from history - the final assistant response
                # already incorporates tool results. Including tool_calls without their
                # corresponding tool response messages would violate OpenAI's API requirements.
                messages.append(message_dict)
            
            # Define function for image generation
            functions = [
                {
                    "type": "function",
                    "function": {
                        "name": "generate_image",
                        "description": "Generate an image using DALL-E 3. Use this when the user asks to create, generate, make, or draw an image, picture, illustration, or visual representation.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "prompt": {
                                    "type": "string",
                                    "description": "A detailed description of the image to generate. Include all relevant details from the user's request."
                                }
                            },
                            "required": ["prompt"]
                        }
                    }
                }
            ]
            
            # Use gpt-4o for better multi-modal and function calling support
            model = "gpt-4o"
            
            images = []
            
            # First, make a non-streaming call to check for function calls
            initial_response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=functions,
                tool_choice="auto",
                temperature=0.7,
            )
            
            assistant_message = initial_response.choices[0].message
            tool_calls = assistant_message.tool_calls or []
            
            # Handle function calls (image generation)
            if tool_calls:
                # Add assistant message with tool calls
                messages.append({
                    "role": "assistant",
                    "content": assistant_message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": tc.type,
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        } for tc in tool_calls
                    ]
                })
                
                # Process each tool call
                for tool_call in tool_calls:
                    if tool_call.function.name == "generate_image":
                        args = json.loads(tool_call.function.arguments)
                        image_prompt = args.get("prompt", "")
                        
                        # Generate image
                        image_url = _generate_image_with_dalle(image_prompt)
                        if image_url:
                            images.append(image_url)
                            
                            # Add function result to messages (success)
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "content": json.dumps({"image_url": image_url, "status": "generated"})
                            })
                        else:
                            # Add function result to messages (failure)
                            # OpenAI API requires every tool_call_id to have a response
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "content": json.dumps({"status": "failed", "error": _("Image generation failed")})
                            })
                
                # Get final response after function calls (stream this)
                final_response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=functions,
                    tool_choice="auto",
                    temperature=0.7,
                    stream=True,
                )
                
                # Stream the final response
                accumulated_text = ""
                for chunk in final_response:
                    if chunk.choices:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            text_delta = delta.content
                            accumulated_text += text_delta
                            # Emit chunk (sanitization will be done on final message)
                            payload = {"type": "chunk", "delta": text_delta}
                            yield f"data: {json.dumps(payload)}\n\n"
            else:
                # No function calls, emit the content as chunks
                accumulated_text = assistant_message.content or ""
                # Emit the content character by character to simulate streaming
                for char in accumulated_text:
                    payload = {"type": "chunk", "delta": char}
                    yield f"data: {json.dumps(payload)}\n\n"
            
            # Sanitize the accumulated text for security
            sanitized_text = sanitize_tutor_message(accumulated_text)

            # When done, save session and emit final message
            history.append({"role": "assistant", "content": sanitized_text})
            save_chatgpt_session(session_id, history)

            payload = {
                "type": "done",
                "session_id": session_id,
                "message": sanitized_text,
                "images": images,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            
        except Exception as e:
            logger.error(f"Error in ChatGPT stream: {e}")
            error_payload = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_payload)}\n\n"
    
    return event_stream


@chatgpt_bp.route("/api/chatgpt/start", methods=["POST"])
def chatgpt_start():
    """Start a new ChatGPT session."""
    try:
        session_id = str(uuid.uuid4())
        history: List[Dict] = []
        save_chatgpt_session(session_id, history)
        
        return jsonify({
            "session_id": session_id
        })
    except Exception as e:
        logger.error(f"Error starting ChatGPT session: {e}")
        return jsonify({"error": _("Failed to start ChatGPT session.")}), 500


@chatgpt_bp.route("/api/chatgpt/message/stream", methods=["POST"])
def chatgpt_message_stream():
    """
    Stream a ChatGPT response using Server-Sent Events.
    Supports text and images. Image uploads and file attachments are not yet implemented.
    """
    body = request.get_json(silent=True) or {}
    session_id = (body.get("session_id") or "").strip()
    user_message = (body.get("message") or "").strip()
    # Note: images parameter is accepted but not yet used (image uploads not implemented)
    _images = body.get("images", [])  # Base64 encoded images (unused)
    # Note: files support is not yet implemented in the backend
    
    if not session_id:
        return jsonify({"error": _("Missing session id.")}), 400
    if not user_message:
        return jsonify({"error": _("Please provide a message.")}), 400
    if len(user_message) > MESSAGE_MAX_LENGTH:
        return jsonify({"error": _("Message is too long (max %(max)d characters).", max=MESSAGE_MAX_LENGTH)}), 400
    
    session = get_chatgpt_session(session_id)
    if not session:
        return jsonify({"error": _("Session not found or expired.")}), 404
    
    history: List[Dict] = session.get("history", [])
    
    # Append user message to history
    # Note: Image uploads are not yet implemented, so content is always a string.
    # If image uploads are added later, use multimodal format: [{"type": "text", "text": user_message}, ...]
    history.append({"role": "user", "content": user_message})
    
    event_stream = _create_chatgpt_stream_response(history, session_id)
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


@chatgpt_bp.route("/api/chatgpt/proxy-image", methods=["GET"])
def chatgpt_proxy_image():
    """
    Proxy image download to avoid CORS issues.
    Fetches an image from an external URL and returns it.
    """
    image_url = request.args.get("url")
    if not image_url:
        return jsonify({"error": _("Missing image URL.")}), 400
    
    try:
        # Fetch the image from the external URL
        response = requests.get(image_url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Get content type from response headers
        content_type = response.headers.get("content-type", "image/png")
        
        # Create a BytesIO object from the image data
        image_data = BytesIO(response.content)
        
        # Return the image with appropriate headers
        return send_file(
            image_data,
            mimetype=content_type,
            as_attachment=False,
            download_name="image.png"
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"Error proxying image: {e}")
        return jsonify({"error": _("Failed to fetch image: %(error)s", error=str(e))}), 500
    except Exception as e:
        logger.error(f"Unexpected error proxying image: {e}")
        return jsonify({"error": _("Failed to proxy image.")}), 500

