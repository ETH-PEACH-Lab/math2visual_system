"""
Error handlers and middleware for the API.
"""
from flask import jsonify
from flask_babel import _
import logging

logger = logging.getLogger(__name__)


def register_error_handlers(app):
    """Register error handlers with the Flask app."""
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": _("Not found")}), 404
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": _("Bad request")}), 400
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {str(error)}")
        return jsonify({"error": _("Internal server error")}), 500
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({"error": _("Request too large")}), 413
