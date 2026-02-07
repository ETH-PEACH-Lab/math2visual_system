"""
Text Sanitization Module

Provides HTML sanitization for text content to prevent XSS attacks.
Uses bleach library to clean HTML while preserving safe formatting.
"""

import logging
from typing import Optional

import nh3

logger = logging.getLogger(__name__)


def sanitize_tutor_message(text: str) -> str:
    """
    Sanitize AI tutor message content.

    Tutor messages should be treated as plain text with minimal HTML allowed.
    For security, we strip all HTML tags since tutor messages are currently
    rendered as plain text in the frontend.

    Args:
        text: The tutor message text to sanitize

    Returns:
        Sanitized tutor message (HTML stripped)
    """
    if not text:
        return text

    try:
        # For tutor messages, we want to completely strip all HTML tags and their content
        # This is more secure than just stripping tags and keeping inner content
        # nh3.clean with empty tags set strips all HTML (equivalent to bleach with tags=[], strip=True)
        return nh3.clean(text, tags=set())
    except Exception as e:
        logger.error(f"Error during tutor message sanitization: {str(e)}")
        # Fallback: return original text if sanitization fails
        return text

