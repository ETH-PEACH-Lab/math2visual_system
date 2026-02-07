"""Tutor session storage service for tutor sessions.

All tutor sessions are persisted in the database so that they are shared
across all Gunicorn workers and survive process restarts.
"""
import logging
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Session expiration (hours of inactivity), configurable via environment.
# Defaults to 2 hours if TUTOR_SESSION_EXPIRATION_HOURS is not set.
SESSION_EXPIRATION_HOURS = float(os.getenv("TUTOR_SESSION_EXPIRATION_HOURS", "2"))


def get_session(session_id: str) -> Optional[Dict]:
    """
    Get a tutor session by ID.
    Returns None if session doesn't exist or is expired.
    When analytics is enabled, sessions never expire and are not deleted.
    """
    try:
        from app.config.database import db_session
        from app.models.tutor_session import TutorSession
        
        with db_session() as db:
            session = db.query(TutorSession).filter_by(session_id=session_id).first()
            if not session:
                return None
            
            # Check expiration - is_expired() already returns False when analytics is enabled
            if session.is_expired():
                db.delete(session)
                db.commit()
                return None
            
            # Update last activity
            session.last_activity = datetime.now(timezone.utc)
            db.commit()
            
            return session.to_dict()
    except Exception as e:
        logger.error(f"Error getting session from database: {e}.")
        return None


def save_session(session_id: str, visual_language: str, history: List[Dict], metadata: Optional[Dict] = None) -> None:
    """
    Save or update a tutor session.
    metadata: Optional dictionary for additional session data (e.g., preferred_variant)
    """
    try:
        from app.config.database import db_session
        from app.models.tutor_session import TutorSession
        
        with db_session() as db:
            session = db.query(TutorSession).filter_by(session_id=session_id).first()
            now = datetime.now(timezone.utc)
            
            if session:
                # Update existing session
                session.visual_language = visual_language
                session.history = history
                session.last_activity = now
                # Merge metadata if provided
                if metadata:
                    current_metadata = session.session_metadata or {}
                    current_metadata.update(metadata)
                    session.session_metadata = current_metadata
            else:
                # Create new session
                session = TutorSession(
                    session_id=session_id,
                    visual_language=visual_language,
                    history=history,
                    session_metadata=metadata or {},
                    created_at=now,
                    last_activity=now
                )
                db.add(session)
            
            db.commit()
    except Exception as e:
        logger.error(f"Error saving session to database: {e}.")


def delete_session(session_id: str) -> None:
    """Delete a tutor session."""
    try:
        from app.config.database import db_session
        from app.models.tutor_session import TutorSession
        
        with db_session() as db:
            session = db.query(TutorSession).filter_by(session_id=session_id).first()
            if session:
                db.delete(session)
                db.commit()
    except Exception as e:
        logger.error(f"Error deleting session from database: {e}.")


def cleanup_expired_sessions() -> int:
    """
    Clean up expired sessions from database.
    Returns the number of sessions deleted.
    When analytics is enabled, no sessions are deleted (returns 0).
    """
    from app.config.database import is_analytics_enabled
    
    # Skip cleanup if analytics is enabled
    if is_analytics_enabled():
        logger.debug("Analytics is enabled, skipping session cleanup")
        return 0
    
    try:
        from app.config.database import db_session
        from app.models.tutor_session import TutorSession
        
        with db_session() as db:
            expiration_time = datetime.now(timezone.utc) - timedelta(hours=SESSION_EXPIRATION_HOURS)
            expired_sessions = db.query(TutorSession).filter(
                TutorSession.last_activity < expiration_time
            ).all()
            
            count = len(expired_sessions)
            for session in expired_sessions:
                db.delete(session)
            
            db.commit()
            return count
    except Exception as e:
        logger.error(f"Error cleaning up expired sessions: {e}")
        return 0
