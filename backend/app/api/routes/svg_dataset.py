"""
SVG Dataset API routes for fetching, searching, and uploading SVG files.
"""
import os
import re
import shutil
from flask import Blueprint, request, jsonify, send_file, current_app

from app.config.storage_config import get_svg_dataset_path
from app.services.validation.svg_validator import validate_file
from app.services.svg_generation.svg_generator import generate_svg_icon
from app.utils.translations import expand_search_terms
from app.utils.validation_constants import MAX_REQUEST_BODY_SIZE
from flask_babel import _
from werkzeug.utils import secure_filename

svg_dataset_bp = Blueprint('svg_dataset', __name__)

# Temporary storage directory for generated SVGs
# Use absolute path based on app root directory
_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
TEMP_SVG_DIR = os.path.join(_base_dir, "storage", "temp_svgs")
# Resolve to absolute path to avoid relative path issues
TEMP_SVG_DIR = os.path.abspath(TEMP_SVG_DIR)
os.makedirs(TEMP_SVG_DIR, exist_ok=True)


@svg_dataset_bp.route("/api/svg-dataset/search", methods=["GET"])
def search_svg_files():
    """
    Search SVG files in the dataset by name.
    
    Query parameters:
        - query: Search string to match against SVG filenames (without extension)
        - limit: Maximum number of results (default: 10)
        
    Returns:
        JSON response with matching SVG files and their preview URLs
    """
    try:
        query = request.args.get('query', '').strip().lower()
        limit = int(request.args.get('limit', 10))
        
        if limit > 50:  # Safety limit
            limit = 50
            
        svg_dataset_dir = get_svg_dataset_path()
        
        if not os.path.exists(svg_dataset_dir):
            current_app.logger.error("SVG dataset directory not found")
            return jsonify({"error": _("SVG dataset directory not found")}), 404
        
        # Get all SVG files
        try:
            all_files = os.listdir(svg_dataset_dir)
            svg_files = []
            
            for filename in all_files:
                if filename.lower().endswith('.svg'):
                    file_path = os.path.join(svg_dataset_dir, filename)
                    
                    # Verify file exists and is readable
                    if os.access(file_path, os.R_OK):
                        svg_files.append({
                            'filename': filename,
                            'name': filename[:-4],  # Remove .svg extension
                            'path': file_path
                        })
                    else:
                        current_app.logger.warning(f"⚠️ Skipping unreadable file: {filename}")
                        
        except PermissionError:
            current_app.logger.warning("Permission denied accessing SVG dataset")
            return jsonify({"error": _("Permission denied accessing SVG dataset")}), 403
        
        # If no query, return all files up to limit
        if not query:
            return jsonify({
                "files": svg_files[:limit]
            })
        
        # Expand query to include translations (e.g., "apple" -> ["apple", "apfel"])
        search_terms = expand_search_terms(query)
        current_app.logger.debug(f"Search terms (including translations): {search_terms}")
        
        # Score and sort files by relevance
        scored_files = []
        for file_info in svg_files:
            name = file_info['name'].lower()
            # Calculate score for each search term and take the highest
            max_score = 0
            for search_term in search_terms:
                score = _calculate_relevance_score(search_term, name)
                max_score = max(max_score, score)
            
            if max_score > 0:
                scored_files.append((max_score, file_info))
        
        # Sort by score (highest first) and take top results
        scored_files.sort(key=lambda x: x[0], reverse=True)
        top_files = [file_info for _, file_info in scored_files[:limit]]
        
        return jsonify({
            "files": top_files,
            "query": query
        })
        
    except Exception as e:
        current_app.logger.error(f"Search failed: {str(e)}")
        return jsonify({"error": _("Search failed: %(error)s", error=str(e))}), 500
        

def _calculate_relevance_score(query: str, filename: str) -> int:
    """
    Calculate relevance score for filename matching.

    Higher scores indicate better matches:
    - Exact match: 100
    - Starts with query: 80
    - Word boundary match: 70
    - Contains query: 60
    """
    if not query or not filename:
        return 0
    
    # Exact match
    if filename == query:
        return 100
    
    # Starts with query
    if filename.startswith(query):
        return 80
    
    # Word boundary match (query starts a word in filename)
    word_pattern = r'\b' + re.escape(query)
    if re.search(word_pattern, filename):
        return 70
    
    # Contains query
    if query in filename:
        return 60

    return 0


@svg_dataset_bp.route("/api/svg-dataset/upload", methods=["POST"])
def upload_svg():
    """
    Upload SVG file to the svg_dataset directory with enhanced validation and security.
    
    Expects:
        - file: SVG file upload
        - expected_filename: Expected filename for validation
        
    Returns:
        JSON response with success status and validation details
    """
    try:
        # Check request size limit (matches MAX_REQUEST_BODY_SIZE from validation_constants)
        if request.content_length and request.content_length > MAX_REQUEST_BODY_SIZE:
            max_mb = MAX_REQUEST_BODY_SIZE // (1024 * 1024)
            return jsonify({"success": False, "error": _("Request too large (max %(max)dMB)", max=max_mb)}), 413
        
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({"success": False, "error": _("No file uploaded")}), 400
        
        file = request.files['file']
        expected_filename = request.form.get('expected_filename')
        
        if not expected_filename:
            return jsonify({"success": False, "error": _("Expected filename not provided")}), 400
        
        if file.filename == '':
            return jsonify({"success": False, "error": _("No file selected")}), 400
        
        # Read file content for validation
        file_content = file.read()
        file.seek(0)  # Reset file pointer
        
        # Comprehensive validation using the SVG validator with antivirus scanning
        is_valid, validation_error, validation_details = validate_file(
            file_content, expected_filename, include_antivirus=True
        )
        if not is_valid:
            return jsonify({
                "success": False, 
                "error": validation_error,
                "validation_details": validation_details
            }), 400
        
        # Secure the filename and prepare directory
        secure_name = secure_filename(expected_filename)
        svg_dataset_dir = get_svg_dataset_path()
        os.makedirs(svg_dataset_dir, exist_ok=True)
        
        file_path = os.path.join(svg_dataset_dir, secure_name)
        
        # Check if file already exists
        if os.path.exists(file_path):
            return jsonify({
                "success": False, 
                "error": _("File already exists or has been added by another user in the meantime: %(filename)s", filename=secure_name)
            }), 409
        
        # Save the file with atomic write (write to temp file then rename)
        temp_path = file_path + '.tmp'
        try:
            with open(temp_path, 'wb') as f:
                f.write(file_content)
            
            # Atomic move
            if os.path.exists(file_path):
                os.remove(file_path)
            os.rename(temp_path, file_path)
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
        
        return jsonify({
            "success": True, 
            "message": _("SVG file uploaded successfully: %(filename)s", filename=secure_name),
            "validation_details": validation_details
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": _("Upload failed: %(error)s", error=str(e))}), 500


@svg_dataset_bp.route("/api/svg-dataset/check-exists", methods=["GET"])
def check_svg_exists():
    """
    Check if an SVG name already exists in the dataset.
    
    Query parameters:
        - name: SVG name to check (without extension)
        
    Returns:
        JSON response with exists boolean
    """
    try:
        name = request.args.get('name', '').strip()
        
        if not name:
            return jsonify({"error": _("Name parameter is required")}), 400
            
        svg_dataset_dir = get_svg_dataset_path()
        
        if not os.path.exists(svg_dataset_dir):
            return jsonify({"error": _("SVG dataset directory not found")}), 404
        
        # Check if file exists
        svg_filename = f"{name}.svg"
        svg_path = os.path.join(svg_dataset_dir, svg_filename)
        exists = os.path.exists(svg_path)
        
        return jsonify({
            "exists": exists,
            "name": name
        })
        
    except Exception as e:
        return jsonify({"error": _("Check failed: %(error)s", error=str(e))}), 500


@svg_dataset_bp.route("/api/svg-dataset/files/<filename>", methods=["GET"])
def serve_svg_file(filename):
    """
    Serve SVG files from the dataset.
    
    Args:
        filename: The SVG filename to serve
        
    Returns:
        SVG file content with appropriate headers
    """
    try:
        # Security check - only allow .svg files
        if not filename.lower().endswith('.svg'):
            current_app.logger.warning(f"❌ Invalid file extension: {filename}")
            return jsonify({"error": _("Only SVG files are allowed")}), 400
        
        svg_dataset_dir = get_svg_dataset_path()
        
        # First try the filename as-is (for files with spaces, special chars)
        file_path = os.path.join(svg_dataset_dir, filename)
        current_app.logger.debug(f"🔍 Looking for file: {file_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            current_app.logger.warning(f"❌ File not found: {filename} (tried both original and secure)")
            return jsonify({"error": _("File not found")}), 404
        
        # Check file permissions
        if not os.access(file_path, os.R_OK):
            current_app.logger.warning(f"❌ File not readable: {file_path}")
            return jsonify({"error": _("File not accessible")}), 403
        
        # Check file size (prevent serving empty or corrupted files)
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            current_app.logger.warning(f"❌ Empty file: {file_path}")
            return jsonify({"error": _("Empty file")}), 400
        
        current_app.logger.info(f"✅ Serving file: {filename} ({file_size} bytes)")
        
        # Serve the file
        return send_file(
            file_path,
            mimetype='image/svg+xml',
            as_attachment=False,
            download_name=filename
        )
        
    except Exception as e:
        current_app.logger.error(f"❌ Error serving {filename}: {str(e)}")
        return jsonify({"error": _("Failed to serve file: %(error)s", error=str(e))}), 500


@svg_dataset_bp.route("/api/svg-dataset/generate", methods=["POST"])
def generate_svg():
    """
    Generate an SVG icon using AI and store it temporarily.
    
    Expects:
        - entity_type: Sanitized entity type to generate icon for
        
    Returns:
        JSON response with SVG content and temporary filename
    """
    try:
        body = request.json or {}
        entity_type = body.get('entity_type', '').strip()
        
        if not entity_type:
            return jsonify({
                "success": False,
                "error": _("Entity type is required")
            }), 400
        
        current_app.logger.info(f"🎨 Generating SVG icon for: {entity_type}")
        
        # Generate SVG using Gemini
        success, svg_content, error = generate_svg_icon(entity_type)
        
        if not success or not svg_content:
            error_text = error or _("Failed to generate SVG")
            return jsonify({
                "success": False,
                "error": error_text
            }), 500
        
        # Count existing files with the same name in the dataset
        svg_dataset_dir = get_svg_dataset_path()
        base_name = entity_type.lower().replace(' ', '-')
        
        # Count files matching the pattern: base_name.svg or base_name-N.svg
        pattern = re.compile(rf'^{re.escape(base_name)}(-\d+)?\.svg$', re.IGNORECASE)
        count = sum(1 for f in os.listdir(svg_dataset_dir) if pattern.match(f))
        
        # Generate temporary filename (only append suffix if needed)
        if count == 0:
            temp_filename = f"{base_name}.svg"
        else:
            temp_filename = f"{base_name}-{count+1}.svg"
        temp_path = os.path.join(TEMP_SVG_DIR, temp_filename)
        
        # Validate the generated SVG
        is_valid, validation_error, validation_details = validate_file(
            svg_content.encode('utf-8'), 
            temp_filename, 
            include_antivirus=True
        )
        
        if not is_valid:
            return jsonify({
                "success": False,
                "error": _("Generated SVG validation failed: %(error)s", error=validation_error)
            }), 400
        
        # Save to temporary location
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        
        current_app.logger.info(f"✅ SVG generated and saved to: {temp_path}")
        
        return jsonify({
            "success": True,
            "svg_content": svg_content,
            "temp_filename": temp_filename,
            "message": _("SVG icon generated successfully: %(entity_type)s", entity_type=entity_type)
        })
        
    except Exception as e:
        current_app.logger.error(f"❌ Generation failed: {str(e)}")
        return jsonify({
            "success": False,
            "error": _("Generation failed: %(error)s", error=str(e))
        }), 500


@svg_dataset_bp.route("/api/svg-dataset/confirm-generated", methods=["POST"])
def confirm_generated_svg():
    """
    Move a generated SVG from temporary storage to the dataset.
    
    Expects:
        - temp_filename: The temporary filename to confirm
        
    Returns:
        JSON response with success status and final filename
    """
    try:
        body = request.json or {}
        temp_filename = body.get('temp_filename', '').strip()
        
        if not temp_filename:
            return jsonify({
                "success": False,
                "error": _("Temporary filename is required")
            }), 400
        
        # Sanitize filename to prevent path traversal
        temp_filename = secure_filename(temp_filename)
        if not temp_filename or not temp_filename.endswith('.svg'):
            return jsonify({
                "success": False,
                "error": _("Invalid filename")
            }), 400
        
        temp_path = os.path.join(TEMP_SVG_DIR, temp_filename)
        
        if not os.path.exists(temp_path):
            return jsonify({
                "success": False,
                "error": _("Temporary file not found")
            }), 404
        
        # Move to dataset
        svg_dataset_dir = get_svg_dataset_path()
        final_path = os.path.join(svg_dataset_dir, temp_filename)
        
        # Check if file already exists in dataset
        if os.path.exists(final_path):
            return jsonify({
                "success": False,
                "error": _("File already exists in dataset: %(filename)s", filename=temp_filename)
            }), 409
        
        # Move the file
        shutil.move(temp_path, final_path)
        
        current_app.logger.info(f"✅ Confirmed SVG moved to dataset: {final_path}")
        
        return jsonify({
            "success": True,
            "filename": temp_filename,
            "message": _("SVG added to dataset: %(filename)s", filename=temp_filename)
        })
        
    except Exception as e:
        current_app.logger.error(f"❌ Confirmation of temporary SVG failed: {str(e)}")
        return jsonify({
            "success": False,
            "error": _("Confirmation of temporary SVG failed: %(error)s", error=str(e))
        }), 500

