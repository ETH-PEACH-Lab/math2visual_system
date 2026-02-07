"""
Database model for ChatGPT sessions in Math2Visual.
Stores ChatGPT session data in the database to support multiple Gunicorn workers.
"""
import logging
from datetime import datetime, timezone
from typing import Dict
from sqlalchemy import Column, String, JSON, Index
from app.config.database import UTCDateTime
from app.models.user_actions import Base

logger = logging.getLogger(__name__)


class ChatGPTSession(Base):
    """Represents a ChatGPT session for analytics mode chat interface."""
    
    __tablename__ = 'chatgpt_sessions'
    
    session_id = Column(String(36), primary_key=True)
    history = Column(JSON, nullable=False, default=list)
    # Store UTC timestamps as timezone-aware datetimes (TIMESTAMP WITH TIME ZONE in PostgreSQL)
    # UTCDateTime ensures all retrieved values are normalized to UTC, regardless of connection timezone
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    last_activity = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_chatgpt_session_last_activity', 'last_activity'),
        Index('idx_chatgpt_session_created', 'created_at'),
    )
    
    def is_expired(self) -> bool:
        """Check if the session has expired.
        ChatGPT sessions never expire since they are only used when analytics is enabled,
        and analytics sessions should be preserved for research purposes.
        """
        # ChatGPT sessions are only available when analytics is enabled,
        # and in that case, sessions should never expire
        return False
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary format compatible with existing code."""
        return {
            "history": self.history or [],
            "created_at": self.created_at,
        }
    
    def __repr__(self):
        return f"<ChatGPTSession(session_id={self.session_id}, created_at={self.created_at}, last_activity={self.last_activity})>"

