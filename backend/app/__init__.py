"""
Flask application factory for Math2Visual backend.
"""
import os
import logging
from flask import Flask, send_from_directory, request
from flask_cors import CORS
from flask_babel import Babel

from app.config.storage_config import validate_storage_config, storage_config
from app.config.database import init_database, test_database_connection
from app.api.routes.generation import generation_bp
from app.api.routes.system import system_bp
from app.api.routes.svg_dataset import svg_dataset_bp
from app.api.routes.analytics import analytics_bp
from app.api.routes.tutor import tutor_bp
from app.api.routes.chatgpt import chatgpt_bp
from app.api.middleware.error_handlers import register_error_handlers
from app.utils.translations import ensure_translation_models_installed

# Disable IPython logging
logging.getLogger('IPython').setLevel(logging.WARNING)
logging.getLogger('IPython.core').setLevel(logging.WARNING)
logging.getLogger('IPython.display').setLevel(logging.WARNING)


def _get_cors_origins():
    """
    Determine allowed CORS origins based on environment configuration.

    Supports:
    - Explicit comma-separated origins
    - Frontend URL for automatic origin extraction
    - Environment-specific defaults
    - Wildcard patterns (for advanced use cases)

    Returns:
        List of allowed origins
    """
    # Check for explicit CORS origins environment variable
    cors_origins_env = os.getenv('CORS_ORIGINS')
    if cors_origins_env:
        # Parse comma-separated list of origins
        origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
        return origins if origins else _get_default_origins()

    # Check for frontend URL (automatic origin extraction)
    frontend_url = os.getenv('FRONTEND_URL')
    if frontend_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(frontend_url)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"
                # Also allow common variants
                origins = [origin]
                # Add www. variant if not present
                if parsed.netloc.startswith('www.'):
                    origins.append(f"{parsed.scheme}://{parsed.netloc[4:]}")
                else:
                    origins.append(f"{parsed.scheme}://www.{parsed.netloc}")
                return origins
        except Exception:
            # If parsing fails, fall back to defaults
            pass

    # Fall back to environment-specific defaults
    return _get_default_origins()


def _get_default_origins():
    """
    Get default CORS origins based on environment.

    Returns:
        List of allowed origins
    """
    env = os.getenv('FLASK_ENV', 'development')

    if env == 'development':
        # Allow common development origins
        return [
            "http://localhost:3000",    # React default
            "http://localhost:5173",    # Vite default (Vite)
            "http://127.0.0.1:3000",   # Alternative localhost
            "http://127.0.0.1:5173",   # Alternative localhost
            "http://localhost:8080",   # Alternative dev port
            "http://localhost:4000",   # Alternative dev port
        ]

    elif env == 'production':
        # In production, be very restrictive by default
        # Require explicit configuration via CORS_ORIGINS or FRONTEND_URL
        return []

    else:
        # Test/staging environments - allow some flexibility
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]


def create_app():
    """Create and configure the Flask application."""
    # Determine static folder path (for serving frontend in Docker)
    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
    static_folder = static_folder if os.path.exists(static_folder) else None
    
    app = Flask(__name__, static_folder=static_folder, static_url_path='')

    # Configure CORS based on environment
    cors_origins = _get_cors_origins()
    cors_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_headers = ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]

    # Log CORS configuration for debugging
    env = os.getenv('FLASK_ENV', 'development')
    print(f"🔒 CORS configured for {env} environment:")
    print(f"   Origins: {cors_origins if cors_origins else 'None (CORS disabled)'}")
    print(f"   Methods: {cors_methods}")
    print(f"   Headers: {cors_headers}")

    # Configure CORS only if origins are specified
    if cors_origins:
        CORS(app,
             origins=cors_origins,
             methods=cors_methods,
             headers=cors_headers,
             supports_credentials=True,
             max_age=86400)  # Cache preflight for 24 hours
    else:
        print("⚠️  No CORS origins configured - CORS disabled for security")
        print("   Set CORS_ORIGINS or FRONTEND_URL environment variables to enable CORS")
    
    # Configure request size limits for security
    from app.utils.validation_constants import MAX_REQUEST_BODY_SIZE
    app.config['MAX_CONTENT_LENGTH'] = MAX_REQUEST_BODY_SIZE
    
    # Configure Flask-Babel for internationalization
    app.config['LANGUAGES'] = {
        'en': 'English',
        'de': 'German'
    }
    app.config['BABEL_DEFAULT_LOCALE'] = 'en'
    app.config['BABEL_DEFAULT_TIMEZONE'] = 'UTC'
    app.config['BABEL_TRANSLATION_DIRECTORIES'] = 'translations'
    
    def get_locale():
        """Select locale based on Accept-Language header."""
        # Flask-Babel's request.accept_languages.best_match automatically
        # validates against LANGUAGES config, so we can use it directly
        return request.accept_languages.best_match(app.config['LANGUAGES'].keys()) or app.config['BABEL_DEFAULT_LOCALE']
    
    babel = Babel(app, locale_selector=get_locale)
    
    # Validate storage configuration on startup
    is_valid, error = validate_storage_config()
    if not is_valid:
        print(f"⚠️  Storage configuration issue: {error}")
        print(f"📍 Current storage info: {storage_config.get_storage_info()}")
    else:
        print(f"✅ Storage configured: {storage_config.storage_mode} mode")
        print(f"📁 SVG dataset path: {storage_config.svg_dataset_path}")
    
    # Initialize database
    if test_database_connection():
        init_database()
        print("✅ Analytics database initialized")
    else:
        print("⚠️  Analytics database not available - user tracking disabled")
    
    # Check and install translation models if missing
    ensure_translation_models_installed(auto_install=True)
    
    # Register blueprints
    app.register_blueprint(generation_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(svg_dataset_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(tutor_bp)
    app.register_blueprint(chatgpt_bp)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Serve frontend static files if they exist (for Docker deployment)
    if static_folder and os.path.exists(static_folder):
        @app.route('/', defaults={'path': ''}, methods=['GET'])
        @app.route('/<path:path>', methods=['GET'])
        def serve_frontend(path):
            """Serve frontend static files and handle client-side routing."""
            # Don't interfere with API routes - let Flask handle 404 for unmatched API routes
            if path.startswith('api'):
                from flask import abort
                abort(404)
            
            # Try to serve the requested file if it exists
            if path:
                file_path = os.path.join(static_folder, path)
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    return send_from_directory(static_folder, path)
            
            # For client-side routing, serve index.html for all non-API routes
            return send_from_directory(static_folder, 'index.html')
        
        print(f"✅ Frontend static files configured: {static_folder}")
    
    return app
