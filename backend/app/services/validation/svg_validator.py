"""
SVG File Validation and Security Module

This module provides comprehensive validation and security checking for SVG files,
including content analysis, filename validation, file integrity verification,
and optional ClamAV antivirus scanning with graceful fallback.
"""

import re
import magic
import logging
from typing import Optional, Tuple, Dict, Any

# Import ClamAV scanner with graceful handling
try:
    from .security_scanner import scan_file_content, is_clamav_available, get_clamav_status, ScanResult
    CLAMAV_SCANNER_AVAILABLE = True
except ImportError as e:
    print(f"ClamAV scanner not available: {e}")
    CLAMAV_SCANNER_AVAILABLE = False
    ScanResult = None

logger = logging.getLogger(__name__)

# Import maximum request body size from validation constants (single source of truth)
# Note: nginx.conf client_max_body_size should match this value (currently 12MB)
from app.utils.validation_constants import MAX_REQUEST_BODY_SIZE


class SVGValidationError(Exception):
    """Custom exception for SVG validation errors."""
    pass


class SVGValidator:
    """
    Comprehensive SVG file validator with security-focused content analysis.
    """
    
    # Maximum file sizes - use MAX_REQUEST_BODY_SIZE from validation_constants
    # to maintain single source of truth across backend components
    MAX_RAW_FILE_SIZE = MAX_REQUEST_BODY_SIZE
    MAX_DECODED_FILE_SIZE = MAX_REQUEST_BODY_SIZE
    MAX_FILENAME_LENGTH = 255
    
    # Dangerous content patterns for SVG security
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>',           # Script tags
        r'javascript:',             # JavaScript URLs
        r'data:text/html',          # HTML data URLs
        r'data:application/',       # Application data URLs
        r'<iframe[^>]*>',          # Iframe tags
        r'<object[^>]*>',          # Object tags
        r'<embed[^>]*>',           # Embed tags
        r'<link[^>]*>',            # Link tags
        r'<meta[^>]*>',            # Meta tags
        r'<base[^>]*>',            # Base tags
        r'<form[^>]*>',            # Form tags
        r'on\w+\s*=',              # Event handlers (onclick, onload, etc.)
        r'<!\[CDATA\[.*?\]\]>',    # CDATA sections
        r'<style[^>]*>.*?</style>', # Style tags with potential CSS injection
        r'@import\s+',             # CSS imports
        r'expression\s*\(',        # CSS expressions
        r'url\s*\(\s*["\']?\s*javascript:', # CSS JavaScript URLs
    ]
    
    @classmethod
    def validate_filename(cls, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate filename for security and format compliance.
        
        Args:
            filename: The filename to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not filename:
            return False, "Filename cannot be empty"
            
        if len(filename) > cls.MAX_FILENAME_LENGTH:
            return False, f"Filename too long (max {cls.MAX_FILENAME_LENGTH} characters)"
        
        # Allow only safe characters
        safe_pattern = re.compile(r'^[a-zA-Z0-9._-]+$')
        if not safe_pattern.match(filename):
            return False, "Filename contains invalid characters. Only alphanumeric characters, dots, dashes, and underscores are allowed"
        
        # Prevent path traversal
        if '..' in filename or filename.startswith('.'):
            return False, "Filename cannot contain path traversal sequences"
            
        # Must end with .svg
        if not filename.lower().endswith('.svg'):
            return False, "File must have .svg extension"
            
        return True, None
    
    @classmethod
    def validate_file_size(cls, content: bytes) -> Tuple[bool, Optional[str]]:
        """
        Validate file size constraints.
        
        Args:
            content: File content as bytes
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if len(content) == 0:
            return False, "File is empty"
            
        if len(content) > cls.MAX_RAW_FILE_SIZE:
            return False, f"File too large (max {cls.MAX_RAW_FILE_SIZE // (1024*1024)}MB)"
            
        return True, None
    
    @classmethod
    def validate_file_type(cls, content: bytes) -> Tuple[bool, Optional[str]]:
        """
        Validate file type using python-magic.
        
        Args:
            content: File content as bytes
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            file_type = magic.from_buffer(content, mime=True)
            if not file_type.startswith('image/svg') and not file_type.startswith('text/'):
                return False, f"Invalid file type '{file_type}'. Must be SVG"
        except Exception as e:
            # If magic detection fails, we'll rely on content validation
            # This is not a hard failure
            pass
            
        return True, None
    
    @classmethod
    def validate_svg_structure(cls, content_str: str) -> Tuple[bool, Optional[str]]:
        """
        Validate basic SVG structure and XML validity.
        
        Args:
            content_str: File content as string
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Basic SVG structure validation
        if '<svg' not in content_str.lower():
            return False, "File does not contain valid SVG structure"
        
        # Check file size in decoded form
        if len(content_str) > cls.MAX_DECODED_FILE_SIZE:
            return False, f"Decoded file content too large (max {cls.MAX_DECODED_FILE_SIZE // (1024*1024)}MB)"
            
        # Basic XML structure validation
        svg_count = content_str.lower().count('<svg')
        closing_svg_count = content_str.lower().count('</svg>')
        
        if svg_count != closing_svg_count:
            return False, "Invalid SVG structure: mismatched <svg> tags"
            
        return True, None
    
    @classmethod
    def scan_for_malicious_content(cls, content_str: str) -> Tuple[bool, Optional[str]]:
        """
        Scan content for potentially malicious patterns.
        
        Args:
            content_str: File content as string
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        content_lower = content_str.lower()
        
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE | re.DOTALL):
                return False, f"File contains potentially malicious content: {pattern}"
        
        # Additional specific checks
        if 'vbscript:' in content_lower:
            return False, "File contains VBScript which is not allowed"
            
        if 'data:image/svg+xml' in content_lower and 'base64' in content_lower:
            return False, "Embedded base64 SVG data URLs are not allowed"
            
        return True, None
    
    @classmethod
    def validate_svg_content(cls, content: bytes) -> Tuple[bool, Optional[str]]:
        """
        Comprehensive SVG content validation.
        
        Args:
            content: File content as bytes
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Convert to string for content analysis
            try:
                content_str = content.decode('utf-8', errors='strict')
            except UnicodeDecodeError:
                return False, "File contains invalid UTF-8 encoding"
            
            # Validate SVG structure
            is_valid, error = cls.validate_svg_structure(content_str)
            if not is_valid:
                return False, error
            
            # Scan for malicious content
            is_safe, error = cls.scan_for_malicious_content(content_str)
            if not is_safe:
                return False, error
                
            return True, None
            
        except Exception as e:
            return False, f"Content validation error: {str(e)}"
    
    @classmethod
    def scan_for_viruses(cls, content: bytes, filename: str = "unknown") -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Scan file content for viruses using ClamAV with graceful fallback.
        
        Args:
            content: File content as bytes
            filename: Filename for logging purposes
            
        Returns:
            Tuple of (is_clean, error_message, scan_info)
            scan_info contains details about the scan result
        """
        scan_info = {
            'antivirus_available': False,
            'scan_performed': False,
            'threat_found': None,
            'scanner_error': None
        }
        
        if not CLAMAV_SCANNER_AVAILABLE:
            scan_info['scanner_error'] = 'ClamAV scanner module not available'
            logger.debug("ClamAV scanner not available, skipping antivirus scan")
            return True, None, scan_info  # Assume clean if scanner not available
        
        try:
            scan_result = scan_file_content(content, filename)
            
            scan_info.update({
                'antivirus_available': scan_result.scanner_available,
                'scan_performed': scan_result.scan_performed,
                'threat_found': scan_result.threat_found,
                'scanner_error': scan_result.error_message
            })
            
            if not scan_result.scanner_available:
                logger.debug("ClamAV daemon not available, skipping antivirus scan")
                return True, None, scan_info  # Assume clean if daemon not available
            
            if not scan_result.scan_performed:
                logger.warning(f"Antivirus scan failed for {filename}: {scan_result.error_message}")
                return True, None, scan_info  # Assume clean if scan failed
            
            if not scan_result.is_clean:
                error_msg = f"Virus detected: {scan_result.threat_found}"
                logger.warning(f"Virus detected in {filename}: {scan_result.threat_found}")
                return False, error_msg, scan_info
            
            logger.debug(f"File {filename} passed antivirus scan")
            return True, None, scan_info
            
        except Exception as e:
            scan_info['scanner_error'] = str(e)
            logger.error(f"Unexpected error during antivirus scan of {filename}: {str(e)}")
            return True, None, scan_info  # Assume clean on unexpected error


    
    @classmethod
    def validate_file(cls, content: bytes, expected_filename: str, 
                                          include_antivirus: bool = True) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Perform comprehensive file validation with detailed results including antivirus scan information.
        
        Args:
            content: File content as bytes
            expected_filename: Expected filename
            include_antivirus: Whether to include antivirus scanning
            
        Returns:
            Tuple of (is_valid, error_message, validation_details)
        """
        validation_details = {
            'filename_valid': False,
            'size_valid': False,
            'type_valid': False,
            'content_valid': False,
            'antivirus_scan': None
        }
        
        # Validate filename
        is_valid, error = cls.validate_filename(expected_filename)
        validation_details['filename_valid'] = is_valid
        if not is_valid:
            return False, f"Filename validation failed: {error}", validation_details
        
        # Validate file size
        is_valid, error = cls.validate_file_size(content)
        validation_details['size_valid'] = is_valid
        if not is_valid:
            return False, f"File size validation failed: {error}", validation_details
        
        # Validate file type
        is_valid, error = cls.validate_file_type(content)
        validation_details['type_valid'] = is_valid
        if not is_valid:
            return False, f"File type validation failed: {error}", validation_details
        
        # Validate SVG content
        is_valid, error = cls.validate_svg_content(content)
        validation_details['content_valid'] = is_valid
        if not is_valid:
            return False, f"Content validation failed: {error}", validation_details
        
        # Antivirus scan (if enabled)
        if include_antivirus:
            is_clean, error, scan_info = cls.scan_for_viruses(content, expected_filename)
            validation_details['antivirus_scan'] = scan_info
            if not is_clean:
                return False, f"Antivirus scan failed: {error}", validation_details
        
        return True, None, validation_details


# Convenience functions for backward compatibility and ease of use
def validate_svg_content(content: bytes) -> Tuple[bool, Optional[str]]:
    """Convenience function for SVG content validation."""
    return SVGValidator.validate_svg_content(content)


def is_safe_filename(filename: str) -> bool:
    """Convenience function for filename validation."""
    is_valid, _ = SVGValidator.validate_filename(filename)
    return is_valid


def validate_file(content: bytes, expected_filename: str, include_antivirus: bool = True) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Convenience function for comprehensive file validation with detailed results."""
    return SVGValidator.validate_file(content, expected_filename, include_antivirus)


def scan_for_viruses(content: bytes, filename: str = "unknown") -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Convenience function for antivirus scanning."""
    return SVGValidator.scan_for_viruses(content, filename)


def get_antivirus_status() -> Dict[str, Any]:
    """
    Get antivirus scanner status information.
    
    Returns:
        Status dictionary with scanner availability and configuration
    """
    if not CLAMAV_SCANNER_AVAILABLE:
        return {
            'scanner_module_available': False,
            'error': 'ClamAV scanner module not available'
        }
    
    try:
        status = get_clamav_status()
        status['scanner_module_available'] = True
        return status
    except Exception as e:
        return {
            'scanner_module_available': True,
            'error': f'Error getting scanner status: {str(e)}'
        }
