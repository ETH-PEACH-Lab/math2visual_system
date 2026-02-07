"""
Database models for user action recording in Math2Visual.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Index, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import uuid

Base = declarative_base()


class UserSession(Base):
    """Represents a user session for tracking user actions."""
    
    __tablename__ = 'user_sessions'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_activity = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    actions = relationship("Action", back_populates="session", cascade="all, delete-orphan")
    screenshots = relationship("Screenshot", back_populates="session", cascade="all, delete-orphan")
    cursor_positions = relationship("CursorPosition", back_populates="session", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<UserSession(id={self.id}, session_id={self.session_id}, created_at={self.created_at})>"


class Action(Base):
    """Records actions within a session."""
    
    __tablename__ = 'actions'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('user_sessions.id'), nullable=False)
    type = Column(String(50), nullable=False, index=True)  # e.g., 'form_submit', 'element_click', 'download'
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Action-specific data
    data = Column(JSON, nullable=True)  # Flexible JSON for action-specific data

    
    # Relationships
    session = relationship("UserSession", back_populates="actions")
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_action_type_timestamp', 'type', 'timestamp'),
        Index('idx_session_timestamp', 'session_id', 'timestamp'),
    )
    
    def __repr__(self):
        return f"<Action(type={self.type}, timestamp={self.timestamp})>"


# Alias for compatibility
class Screenshot(Base):
    """Stores screenshots for user sessions."""
    
    __tablename__ = 'screenshots'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('user_sessions.id'), nullable=False)
    
    # Screenshot metadata
    file_path = Column(Text, nullable=False)  # Path to the stored screenshot file
    width = Column(Integer, nullable=True)  # Image width in pixels
    height = Column(Integer, nullable=True)  # Image height in pixels
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Relationships
    session = relationship("UserSession", back_populates="screenshots")
    
    # Indexes
    __table_args__ = (
        Index('idx_screenshot_session_created', 'session_id', 'created_at'),
        Index('idx_screenshot_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Screenshot(id={self.id}, created_at={self.created_at})>"


class CursorPosition(Base):
    """Records cursor positions for heat map analysis."""
    
    __tablename__ = 'cursor_positions'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('user_sessions.id'), nullable=False)
    
    # Position data
    x = Column(Float, nullable=False)  # X coordinate
    y = Column(Float, nullable=False)  # Y coordinate
    
    # Context
    element_type = Column(String(50), nullable=True)  # e.g., 'button', 'input', 'div'
    element_id = Column(String(255), nullable=True)  # Element ID if available
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Relationships
    session = relationship("UserSession", back_populates="cursor_positions")
    
    # Indexes for efficient heat map queries
    __table_args__ = (
        Index('idx_cursor_session_timestamp', 'session_id', 'timestamp'),
        Index('idx_cursor_timestamp', 'timestamp'),
    )
    
    def __repr__(self):
        return f"<CursorPosition(id={self.id}, x={self.x}, y={self.y}, timestamp={self.timestamp})>"


# Alias for compatibility with existing code
GenerationSession = UserSession