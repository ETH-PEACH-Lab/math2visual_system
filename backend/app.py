"""
Main application entry point for Math2Visual backend.
This file uses the new organized structure with Flask application factory pattern.
"""
import os
from app import create_app

# Create Flask app using application factory
app = create_app()

if __name__ == "__main__":
    # Enable debug mode only in development environment
    debug_mode = os.getenv('FLASK_ENV', 'development') == 'development'
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)
