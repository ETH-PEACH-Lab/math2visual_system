"""
WSGI entry point for Math2Visual backend.
This file is used by Gunicorn in production to avoid conflicts with the app/ package.
"""
from app import create_app

# Create Flask app using application factory
app = create_app()

