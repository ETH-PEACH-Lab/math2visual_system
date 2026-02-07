"""
System API routes for monitoring and debugging.
"""
from flask import Blueprint, jsonify, current_app, abort
from functools import wraps
import os

from app.services.validation.svg_validator import get_antivirus_status
from app.config.storage_config import storage_config
from flask_babel import _

system_bp = Blueprint('system', __name__)


def debug_only(f):
    """Decorator to restrict routes to debug mode only."""
    @wraps(f)
    def wrapped(**kwargs):
        if not current_app.debug:
            abort(404)
        return f(**kwargs)
    return wrapped


@system_bp.route("/api/storage/status", methods=["GET"])
@debug_only
def storage_status():
    """
    Get storage configuration and status information.
    Useful for monitoring and debugging storage setup.
    
    Returns:
        JSON response with storage configuration and file count information
    """
    try:
        storage_info = storage_config.get_storage_info()
        
        # Add file count if storage is valid
        if storage_info['is_valid']:
            try:
                svg_path = storage_info['svg_dataset_path']
                svg_files = [f for f in os.listdir(svg_path) if f.lower().endswith('.svg')]
                storage_info['svg_file_count'] = len(svg_files)
                
                # Check if a sample file is accessible
                if svg_files:
                    sample_file = os.path.join(svg_path, svg_files[0])
                    storage_info['sample_file_accessible'] = os.access(sample_file, os.R_OK)
                else:
                    storage_info['sample_file_accessible'] = None
                    
            except Exception as e:
                storage_info['file_check_error'] = str(e)
        
        return jsonify({
            "success": True,
            "storage": storage_info
        })
        
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": _("Failed to get storage status: %(error)s", error=str(e))
        }), 500


@system_bp.route("/api/antivirus/status", methods=["GET"])
@debug_only
def antivirus_status():
    """
    Get antivirus scanner status and configuration information.
    Useful for monitoring ClamAV availability and troubleshooting scan issues.
    
    Returns:
        JSON response with antivirus scanner status and configuration
    """
    try:
        antivirus_info = get_antivirus_status()
        
        return jsonify({
            "success": True,
            "antivirus": antivirus_info
        })
        
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": _("Failed to get antivirus status: %(error)s", error=str(e))
        }), 500
