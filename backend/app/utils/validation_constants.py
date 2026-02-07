"""
Shared validation constants for entity type names and string inputs.
These should match the frontend validation rules in validation.ts
"""

# Maximum length for entity type names
ENTITY_TYPE_MAX_LENGTH = 100

# Regex pattern for allowed characters (letters, dashes, spaces)
ENTITY_TYPE_ALLOWED_CHARS_PATTERN = r'^[a-zA-Z\-\s]+$'

# Regex pattern to detect consecutive spaces or dashes
ENTITY_TYPE_CONSECUTIVE_PATTERN = r'\s{2,}|-{2,}'

# String size limits for API inputs (in characters)
MWP_MAX_LENGTH = 5000  # Math word problems
DSL_MAX_LENGTH = 10000  # Visual Language DSL (can be lengthy)
MESSAGE_MAX_LENGTH = 5000  # Chat messages
FORMULA_MAX_LENGTH = 1000  # Mathematical formulas
HINT_MAX_LENGTH = 5000  # Hints (same as MWP)

# Global request body size limit (in bytes)
# This must be large enough for SVG uploads (largest SVG in dataset is ~11.38 MB)
# Also accounts for JSON overhead for other endpoints
# IMPORTANT: nginx.conf client_max_body_size should match this value
# (nginx runs separately, so this value cannot be automatically synced)
MAX_REQUEST_BODY_SIZE = 12 * 1024 * 1024  # 12MB (accommodates SVG uploads)
