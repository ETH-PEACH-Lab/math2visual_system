"""ChatGPT session storage service for ChatGPT sessions.

All ChatGPT sessions are persisted in the database so that they are shared
across all Gunicorn workers and survive process restarts.
"""
import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def get_chatgpt_session(session_id: str) -> Optional[Dict]:
    """
    Get a ChatGPT session by ID.
    Returns None if session doesn't exist or is expired.
    When analytics is enabled, sessions never expire and are not deleted.
    """
    try:
        from app.config.database import db_session, is_analytics_enabled
        from app.models.chatgpt_session import ChatGPTSession
        
        with db_session() as db:
            session = db.query(ChatGPTSession).filter_by(session_id=session_id).first()
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
        logger.error(f"Error getting ChatGPT session from database: {e}")
        return None


def save_chatgpt_session(session_id: str, history: List[Dict]) -> None:
    """Save or update a ChatGPT session."""
    try:
        from app.config.database import db_session
        from app.models.chatgpt_session import ChatGPTSession
        
        with db_session() as db:
            session = db.query(ChatGPTSession).filter_by(session_id=session_id).first()
            now = datetime.now(timezone.utc)
            
            if session:
                # Update existing session
                session.history = history
                session.last_activity = now
            else:
                # Create new session
                session = ChatGPTSession(
                    session_id=session_id,
                    history=history,
                    created_at=now,
                    last_activity=now
                )
                db.add(session)
            
            db.commit()
    except Exception as e:
        logger.error(f"Error saving ChatGPT session to database: {e}")


def cleanup_expired_chatgpt_sessions() -> int:
    """
    Clean up expired ChatGPT sessions from database.
    ChatGPT sessions never expire since they are only used when analytics is enabled,
    and analytics sessions should be preserved for research purposes.
    Returns 0 (no sessions are deleted).
    """
    # ChatGPT sessions are only available when analytics is enabled,
    # and in that case, sessions should never expire
    logger.debug("ChatGPT sessions never expire (analytics mode only)")
    return 0

