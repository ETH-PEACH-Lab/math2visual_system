"""
Database configuration and connection management for Math2Visual.
"""
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Iterator

from sqlalchemy import create_engine, text, event, TypeDecorator, DateTime as SQLDateTime
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from backend .env first (for backend-specific config)
load_dotenv()

# Also load from frontend .env to read VITE_ENABLE_ANALYTICS
# This allows the backend to read analytics settings from the frontend configuration
current_dir = Path(__file__).parent.parent.parent  # backend/
parent_dir = current_dir.parent  # root/
frontend_dir = parent_dir / 'frontend'
load_dotenv(frontend_dir / '.env', override=False)  # Don't override existing env vars

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/math2visual_analytics')
ENGINE = None
SessionLocal = None


class UTCDateTime(TypeDecorator):
    """
    A DateTime type that ensures all retrieved values are timezone-aware UTC.
    This guarantees consistency across all Gunicorn workers by normalizing
    datetimes at the type level, regardless of how PostgreSQL returns them.
    """
    impl = SQLDateTime
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        # Use TIMESTAMP WITH TIME ZONE for PostgreSQL
        return dialect.type_descriptor(SQLDateTime(timezone=True))
    
    def process_result_value(self, value, dialect):
        """Normalize all datetime values to UTC timezone-aware."""
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                # If timezone-naive, assume it's UTC (as stored)
                return value.replace(tzinfo=timezone.utc)
            else:
                # If timezone-aware, convert to UTC
                return value.astimezone(timezone.utc)
        return value


def get_database_url() -> str:
    """Get the database URL from environment variables."""
    return DATABASE_URL


def create_database_engine():
    """Create and configure the database engine."""
    global ENGINE, SessionLocal
    
    if ENGINE is None:
        database_url = get_database_url()
        
        # Configure engine with appropriate settings
        engine_kwargs = {
            'echo': os.getenv('DATABASE_ECHO', 'false').lower() == 'true',
            'pool_pre_ping': True,
            'pool_recycle': 300,  # Recycle connections every 5 minutes
        }
        
        ENGINE = create_engine(database_url, **engine_kwargs)
        
        # For PostgreSQL, ensure all connections use UTC timezone
        # This is critical when using multiple Gunicorn workers to avoid
        # timezone-related session expiration issues
        if database_url.startswith('postgresql'):
            @event.listens_for(ENGINE, "connect")
            def set_timezone_on_connect(dbapi_conn, connection_record):
                """Set timezone to UTC for all new PostgreSQL connections."""
                cursor = dbapi_conn.cursor()
                cursor.execute("SET timezone = 'UTC'")
                cursor.close()
            
            @event.listens_for(ENGINE, "checkout")
            def set_timezone_on_checkout(dbapi_conn, connection_record, connection_proxy):
                """Set timezone to UTC when connections are checked out from the pool.
                This ensures reused connections also have the correct timezone setting.
                """
                cursor = dbapi_conn.cursor()
                cursor.execute("SET timezone = 'UTC'")
                cursor.close()
        
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)
    
    return ENGINE


def get_db() -> Generator[Session, None, None]:
    """Dependency to get database session."""
    if SessionLocal is None:
        create_database_engine()
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session() -> Iterator[Session]:
    """Context manager that wraps get_db() for safe session handling.

    This ensures the generator's cleanup logic is always executed exactly once.
    """
    db_generator = get_db()
    db = next(db_generator)
    try:
        yield db
    finally:
        db_generator.close()


def init_database():
    """Initialize the database with all tables."""
    from app.models.user_actions import Base
    
    engine = create_database_engine()
    
    # Import all models to ensure they're registered with Base.metadata
    from app.models.tutor_session import TutorSession  # noqa: F401
    from app.models.chatgpt_session import ChatGPTSession  # noqa: F401
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")


def is_analytics_enabled() -> bool:
    """
    Check if analytics is enabled.
    Analytics is enabled if VITE_ENABLE_ANALYTICS environment variable is explicitly set to 'true'.
    """
    vite_enable_analytics = os.getenv('VITE_ENABLE_ANALYTICS', '').lower()
    return vite_enable_analytics == 'true'


def test_database_connection():
    """Test the database connection."""
    database_url = get_database_url()
    
    # If DATABASE_URL is empty or not set, analytics is disabled
    if not database_url or database_url.strip() == '':
        return False
    
    try:
        engine = create_database_engine()
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            result.fetchone()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
