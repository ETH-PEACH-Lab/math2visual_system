"""
Generation API routes for visual language processing and SVG generation.
"""
from flask import Blueprint, request, jsonify, current_app
import os
import shutil
import copy
import uuid
from datetime import datetime

from app.services.language_generation.gpt_generator import generate_visual_language
from app.services.visual_generation.formal_generator import FormalVisualGenerator
from app.services.visual_generation.intuitive_generator import IntuitiveVisualGenerator
from app.services.visual_generation.dsl_parser import DSLParser
from app.config.storage_config import get_svg_dataset_path
from app.utils.validation_constants import (
    DSL_MAX_LENGTH, MWP_MAX_LENGTH, FORMULA_MAX_LENGTH, HINT_MAX_LENGTH
)
from flask_babel import _, get_locale

# Check if running in debug mode
DEBUG_MODE = os.getenv('FLASK_DEBUG', 'false').lower() in ('true', '1', 'yes', 'on')

generation_bp = Blueprint('generation', __name__)
output_dir = os.path.join(os.path.dirname(__file__), "../../../storage/output")
resources = get_svg_dataset_path()

class ValidationError(Exception):
    """Raised when DSL validation fails."""
    pass

class VisualGenerationError(Exception):
    """Raised when visual generation fails."""
    pass

def extract_visual_language(text):
    """
    Extracts the visual_language expression from the given text.
    It finds the last occurrence of 'visual_language:' and extracts everything after it.
    """
    keyword = "visual_language:"
    last_index = text.rfind(keyword)  # Find the last occurrence of 'visual_language:'

    if last_index != -1:
        return text[last_index:].strip()  # Extract and return everything after the last occurrence
    else:
        return None  # Return None if no match is found

@generation_bp.route("/api/generate", methods=["POST"])
def generate():
    """
    Generate visual representations from math word problems.
    
    Accepts either:
    - mwp: Math word problem text
    - formula: Optional formula  
    - dsl: Direct DSL input (overrides mwp/formula)
    
    Returns JSON with SVG content for both formal and intuitive representations.
    """
    body = request.json or {}
    
    # Parse DSL input
    if "dsl" in body:
        raw_dsl = body["dsl"].strip()
        if not raw_dsl:
            return jsonify({"error": _("Empty Visual Language provided.")}), 400
        if len(raw_dsl) > DSL_MAX_LENGTH:
            return jsonify({"error": _("Visual Language is too long (max %(max)d characters).", max=DSL_MAX_LENGTH)}), 400
        # Strip the prefix if present
        if raw_dsl.lower().startswith("visual_language:"):
            dsl = raw_dsl.split(":", 1)[1].strip()
        else:
            dsl = raw_dsl
    else:
        # Generate DSL from math word problem
        mwp = body.get("mwp", "").strip()
        formula_raw = body.get("formula")
        hint_raw = body.get("hint")
        formula = formula_raw.strip() if formula_raw else None
        hint = hint_raw.strip() if hint_raw else None
        # Get language from Accept-Language header (via Flask-Babel)
        language = get_locale()
        if not mwp:
            return jsonify({"error": _("Provide a math word problem (MWP).")}), 400
        if len(mwp) > MWP_MAX_LENGTH:
            return jsonify({"error": _("Math word problem is too long (max %(max)d characters).", max=MWP_MAX_LENGTH)}), 400
        if formula and len(formula) > FORMULA_MAX_LENGTH:
            return jsonify({"error": _("Formula is too long (max %(max)d characters).", max=FORMULA_MAX_LENGTH)}), 400
        if hint and len(hint) > HINT_MAX_LENGTH:
            return jsonify({"error": _("Hint is too long (max %(max)d characters).", max=HINT_MAX_LENGTH)}), 400

        # Generate via GPT and extract
        vl_response = generate_visual_language(mwp, formula, hint, language=language)
        # Use parser for extraction
        raw = extract_visual_language(vl_response)
        if not raw:
            return jsonify({"error": _("Did not get Visual Language from AI. Please try again.")}), 500
        dsl = raw.split(":", 1)[1].strip() if raw.lower().startswith("visual_language:") else raw.strip()
    
    # Generate visualizations using shared method
    # Setup output directory with unique file names for parallel requests
    os.makedirs(output_dir, exist_ok=True)
    request_id = str(uuid.uuid4())
    output_file = os.path.join(output_dir, f"formal_{request_id}.svg")
    intuitive_file = os.path.join(output_dir, f"intuitive_{request_id}.svg")
    
    # Initialize generators and DSL parser with translation function
    formal_generator = FormalVisualGenerator(translate=_)
    intuitive_generator = IntuitiveVisualGenerator(translate=_)
    dsl_parser = DSLParser()

    # Parse DSL once using the shared parser
    try:
        data_formal = dsl_parser.parse_dsl(dsl)
        # Create deep copy to avoid mutations
        data_intuitive = copy.deepcopy(data_formal)
    except ValueError as e:
        current_app.logger.error(f"Visual Language parse error: {e}")
        return jsonify({
            "error": _("Visual Language parse error."),
            "is_parse_error": True
        }), 500
    
    
    formal_error = None
    svg_formal = None
    ok_formal = False
    
    try:
        ok_formal = formal_generator.render_svgs_from_data(output_file, resources, data_formal)
        if ok_formal and os.path.exists(output_file):
            with open(output_file, "r") as f1:
                svg_formal = f1.read()
        else:
            # Use the generator's specific error message if available
            generator_error = formal_generator.get_error_message()
            if generator_error:
                formal_error = _("Could not generate formal visualization: %(error)s", error=generator_error)
            else:
                formal_error = _("Could not generate formal visualization. Retrying might help.")
    except (VisualGenerationError, FileNotFoundError) as e:
        formal_error = _("Formal generation error: %(error)s", error=str(e))
    except Exception as e:
        formal_error = _("Unexpected formal generation error: %(error)s", error=str(e))
    

    intuitive_error = None
    svg_intuitive = None
    ok_intu = False
    
    try:
        ok_intu = intuitive_generator.render_svgs_from_data(intuitive_file, resources, data_intuitive)
        if ok_intu and os.path.exists(intuitive_file):
            with open(intuitive_file, "r") as f2:
                svg_intuitive = f2.read()
        else:
            # Use the generator's specific error message if available
            generator_error = intuitive_generator.get_error_message()
            if generator_error:
                intuitive_error = _("Could not generate intuitive visualization: %(error)s", error=generator_error)
            else:
                intuitive_error = _("Could not generate intuitive visualization. Retrying might help.")
    except (VisualGenerationError, FileNotFoundError) as e:
        intuitive_error = _("Intuitive generation error: %(error)s", error=str(e))
    except Exception as e:
        intuitive_error = _("Unexpected intuitive generation error: %(error)s", error=str(e))

    # Archive timestamped copies (only in debug mode)
    if DEBUG_MODE:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        if ok_formal and os.path.exists(output_file):
            shutil.copy(output_file, os.path.join(output_dir, f"formal_{ts}_{request_id}.svg"))
        if ok_intu and os.path.exists(intuitive_file):
            shutil.copy(intuitive_file, os.path.join(output_dir, f"intuitive_{ts}_{request_id}.svg"))

    # Collect missing entities from both generators
    formal_missing_entities = formal_generator.get_missing_entities()
    intuitive_missing_entities = intuitive_generator.get_missing_entities()
    
    # Combine missing entities and remove duplicates while preserving order
    all_missing_entities = list(dict.fromkeys(formal_missing_entities + intuitive_missing_entities))
    
    # Return response immediately - cleanup handled by periodic job
    return jsonify({
        "visual_language": dsl,  # Send formatted DSL instead of raw DSL
        "svg_formal": svg_formal,
        "svg_intuitive": svg_intuitive,
        "formal_error": formal_error,
        "intuitive_error": intuitive_error,
        "missing_svg_entities": all_missing_entities
    })


def _generate_single_svg(dsl: str, variant: str):
    """
    Generate a single SVG (formal or intuitive) from DSL.
    """
    os.makedirs(output_dir, exist_ok=True)
    request_id = str(uuid.uuid4())
    output_file = os.path.join(output_dir, f"{variant}_{request_id}.svg")

    generator = FormalVisualGenerator(translate=_)
    if variant == "intuitive":
        generator = IntuitiveVisualGenerator(translate=_)

    dsl_parser = DSLParser()

    try:
        data = dsl_parser.parse_dsl(dsl)
    except ValueError as e:
        current_app.logger.error(f"Visual Language parse error: {e}")
        return None, _("Visual Language parse error."), [], True

    error = None
    svg_content = None

    try:
        ok = generator.render_svgs_from_data(output_file, resources, data)
        if ok and os.path.exists(output_file):
            with open(output_file, "r") as f:
                svg_content = f.read()
        else:
            generator_error = generator.get_error_message()
            if generator_error:
                error = _("Could not generate %(variant)s visualization: %(error)s", variant=variant, error=generator_error)
            else:
                error = _("Could not generate %(variant)s visualization. Retrying might help.", variant=variant)
    except (VisualGenerationError, FileNotFoundError) as e:
        error = _("%(variant)s generation error: %(error)s", variant=variant.capitalize(), error=str(e))
    except Exception as e:
        error = _("Unexpected %(variant)s generation error: %(error)s", variant=variant, error=str(e))

    missing_entities = generator.get_missing_entities()

    return svg_content, error, missing_entities, False


@generation_bp.route("/api/generate/formal", methods=["POST"])
def generate_formal():
    """
    Generate only the formal visualization for a given DSL.
    """
    body = request.json or {}
    dsl = (body.get("dsl") or "").strip()

    if not dsl:
        return jsonify({"error": _("Empty Visual Language provided.")}), 400
    if len(dsl) > DSL_MAX_LENGTH:
        return jsonify({"error": _("Visual Language is too long (max %(max)d characters).", max=DSL_MAX_LENGTH)}), 400

    svg_content, error, missing_entities, is_parse_error = _generate_single_svg(dsl, "formal")

    status = 400 if error and is_parse_error else 200 if not error else 500

    return jsonify({
        "variant": "formal",
        "visual_language": dsl,
        "svg": svg_content,
        "error": error,
        "missing_svg_entities": missing_entities,
        "is_parse_error": is_parse_error
    }), status


@generation_bp.route("/api/generate/intuitive", methods=["POST"])
def generate_intuitive():
    """
    Generate only the intuitive visualization for a given DSL.
    """
    body = request.json or {}
    dsl = (body.get("dsl") or "").strip()

    if not dsl:
        return jsonify({"error": _("Empty Visual Language provided.")}), 400
    if len(dsl) > DSL_MAX_LENGTH:
        return jsonify({"error": _("Visual Language is too long (max %(max)d characters).", max=DSL_MAX_LENGTH)}), 400

    svg_content, error, missing_entities, is_parse_error = _generate_single_svg(dsl, "intuitive")

    status = 400 if error and is_parse_error else 200 if not error else 500

    return jsonify({
        "variant": "intuitive",
        "visual_language": dsl,
        "svg": svg_content,
        "error": error,
        "missing_svg_entities": missing_entities,
        "is_parse_error": is_parse_error
    }), status


