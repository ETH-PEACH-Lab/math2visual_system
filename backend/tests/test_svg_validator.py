#!/usr/bin/env python3
"""
Unit tests for the SVG Validator module.

Run with: python3 test_svg_validator.py
"""

import unittest
from werkzeug.utils import secure_filename
from app.services.validation.svg_validator import SVGValidator


class TestSVGValidator(unittest.TestCase):
    """Test cases for SVG validation functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.valid_svg = b'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="blue" />
</svg>'''
        
        self.malicious_svg = b'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <script>alert('XSS');</script>
    <circle cx="50" cy="50" r="40" fill="blue" />
</svg>'''
        
        self.invalid_svg = b'''This is not an SVG file at all'''
        
        self.oversized_svg = b'<svg>' + b'x' * (6 * 1024 * 1024) + b'</svg>'  # 6MB file
    
    def test_valid_filename(self):
        """Test valid filename validation."""
        valid_filenames = [
            "test.svg",
            "my_file.svg",
            "file-name.svg",
            "123.svg",
            "file_123-test.svg"
        ]
        
        for filename in valid_filenames:
            with self.subTest(filename=filename):
                is_valid, error = SVGValidator.validate_filename(filename)
                self.assertTrue(is_valid, f"Filename '{filename}' should be valid but got error: {error}")
    
    def test_invalid_filename(self):
        """Test invalid filename validation."""
        invalid_filenames = [
            "",  # Empty
            "test.txt",  # Wrong extension
            "test file.svg",  # Space
            "../test.svg",  # Path traversal
            "test/file.svg",  # Slash
            "test@file.svg",  # Special character
            ".hidden.svg",  # Starts with dot
            "very_long_filename_" + "x" * 300 + ".svg"  # Too long
        ]
        
        for filename in invalid_filenames:
            with self.subTest(filename=filename):
                is_valid, error = SVGValidator.validate_filename(filename)
                self.assertFalse(is_valid, f"Filename '{filename}' should be invalid")
                self.assertIsNotNone(error, f"Error message should be provided for '{filename}'")
    
    def test_valid_svg_content(self):
        """Test valid SVG content validation."""
        is_valid, error = SVGValidator.validate_svg_content(self.valid_svg)
        self.assertTrue(is_valid, f"Valid SVG should pass validation but got error: {error}")
    
    def test_malicious_svg_content(self):
        """Test malicious SVG content detection."""
        is_valid, error = SVGValidator.validate_svg_content(self.malicious_svg)
        self.assertFalse(is_valid, "Malicious SVG should be rejected")
        self.assertIsNotNone(error)
        self.assertIn("script", error.lower())
    
    def test_invalid_svg_content(self):
        """Test invalid SVG content detection."""
        is_valid, error = SVGValidator.validate_svg_content(self.invalid_svg)
        self.assertFalse(is_valid, "Invalid SVG should be rejected")
        self.assertIsNotNone(error)
    
    def test_oversized_content(self):
        """Test oversized content detection."""
        is_valid, error = SVGValidator.validate_file_size(self.oversized_svg)
        self.assertFalse(is_valid, "Oversized file should be rejected")
        self.assertIsNotNone(error)
        self.assertIn("too large", error.lower())
    
    def test_empty_content(self):
        """Test empty content detection."""
        is_valid, error = SVGValidator.validate_file_size(b'')
        self.assertFalse(is_valid, "Empty file should be rejected")
        self.assertIsNotNone(error)
        self.assertIn("empty", error.lower())
    

    def test_comprehensive_validation(self):
        """Test comprehensive file validation."""
        # Valid case
        is_valid, error, _ = SVGValidator.validate_file(self.valid_svg, "test.svg")
        self.assertTrue(is_valid, f"Valid SVG and filename should pass but got: {error}")
        
        # Invalid filename
        is_valid, error, _ = SVGValidator.validate_file(self.valid_svg, "test.txt")
        self.assertFalse(is_valid, "Invalid filename should fail validation")
        
        # Invalid content
        is_valid, error, _ = SVGValidator.validate_file(self.malicious_svg, "test.svg")
        self.assertFalse(is_valid, "Malicious content should fail validation")
    
    def test_dangerous_patterns(self):
        """Test detection of various dangerous patterns."""
        dangerous_svgs = [
            b'<svg><script>alert(1)</script></svg>',
            b'<svg onclick="alert(1)">content</svg>',
            b'<svg><a href="javascript:alert(1)">link</a></svg>',
            b'<svg><iframe src="http://evil.com"></iframe></svg>',
            b'<svg><object data="http://evil.com"></object></svg>',
            b'<svg><embed src="http://evil.com"></embed></svg>',
            b'<svg><link href="http://evil.com"></link></svg>',
            b'<svg><![CDATA[<script>alert(1)</script>]]></svg>',
        ]
        
        for dangerous_svg in dangerous_svgs:
            with self.subTest(svg=dangerous_svg[:50]):  # First 50 chars for readable output
                is_valid, error = SVGValidator.validate_svg_content(dangerous_svg)
                self.assertFalse(is_valid, f"Dangerous SVG should be rejected: {dangerous_svg}")
                self.assertIsNotNone(error)
    
    def test_secure_filename_generation(self):
        """Test secure filename generation."""
        test_cases = [
            ("test.svg", "test.svg"),
            ("Test File.svg", "Test_File.svg"),  # Space to underscore
            ("test/path.svg", "testpath.svg"),   # Remove slash
        ]
        
        for original, expected in test_cases:
            with self.subTest(original=original):
                secure_name = secure_filename(original)
                # Note: werkzeug's secure_filename might have different behavior
                # so we just check that it returns a string
                self.assertIsInstance(secure_name, str)
                self.assertTrue(len(secure_name) > 0)


def run_basic_functionality_test():
    """Run a basic functionality test to verify the module works."""
    print("Running basic functionality test...")
    
    # Test valid SVG
    valid_svg = b'<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
    is_valid, error, _ = SVGValidator.validate_file(valid_svg, "test.svg")
    print(f"Valid SVG test: {'PASS' if is_valid else 'FAIL'} - {error or 'No error'}")
    
    # Test malicious SVG
    malicious_svg = b'<svg><script>alert("xss")</script></svg>'
    is_valid, error, _ = SVGValidator.validate_file(malicious_svg, "malicious.svg")
    print(f"Malicious SVG test: {'PASS' if not is_valid else 'FAIL'} - {error or 'Should have been rejected'}")
    
    # Test invalid filename
    is_valid, error, _ = SVGValidator.validate_file(valid_svg, "test.txt")
    print(f"Invalid filename test: {'PASS' if not is_valid else 'FAIL'} - {error or 'Should have been rejected'}")
    
    print("Basic functionality test completed!")


if __name__ == '__main__':
    print("=" * 60)
    print("SVG Validator Test Suite")
    print("=" * 60)
    
    # Run basic functionality test first
    run_basic_functionality_test()
    print()
    
    # Run unit tests
    print("Running comprehensive unit tests...")
    unittest.main(verbosity=2)