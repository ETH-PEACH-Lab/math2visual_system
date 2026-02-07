"""
SVG generation service using Google's Gemini API.
"""
import os
import re
from typing import Optional, Tuple
from dotenv import load_dotenv
import google.generativeai as genai
import logging

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(override=True)

def generate_svg_icon(entity_name: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Generate an SVG icon using Gemini API.
    
    Args:
        entity_name: The name of the entity/container to generate an icon for
        
    Returns:
        Tuple of (success, svg_content, error_message)
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    
    try:
        # Configure Gemini API
        genai.configure(api_key=api_key)
        
        # Use gemini-pro model (you can adjust this based on your needs)
        model = genai.GenerativeModel('gemini-pro-latest')
        
        # Create the prompt
        prompt = f"Generate a SVG icon for '{entity_name}'."
        
        # Add instructions to ensure we get valid SVG
        full_prompt = f"""{prompt}

Please create a simple, clean SVG icon. The response should contain ONLY the SVG code, starting with <svg and ending with </svg>. 
Requirements:
- Use a viewBox of "0 0 100 100" 
- Make it simple and recognizable
- Use solid colors
- No text or labels
- Return ONLY the SVG code, no explanations or markdown"""

        # Generate content
        response = model.generate_content(full_prompt)
        
        if not response or not response.text:
            return False, None, "No response from Gemini API"
        
        # Extract SVG from response
        svg_content = extract_svg_from_response(response.text)
        
        if not svg_content:
            return False, None, "Could not extract valid SVG from response"
        
        # Basic validation
        if not svg_content.strip().startswith('<svg') or not svg_content.strip().endswith('</svg>'):
            return False, None, "Generated content is not a valid SVG"
        
        return True, svg_content, None
        
    except Exception as e:
        error_msg = f"SVG generation failed: {str(e)}"
        logger.error(error_msg)
        return False, None, error_msg


def extract_svg_from_response(response_text: str) -> Optional[str]:
    """
    Extract SVG content from the API response.
    Handles cases where the response might include markdown code blocks or extra text.
    
    Args:
        response_text: The raw response text from the API
        
    Returns:
        The extracted SVG content or None if not found
    """
    # Remove markdown code blocks if present
    text = response_text.strip()
    
    # Try to extract from markdown code block
    markdown_pattern = r'```(?:svg|xml)?\s*(.*?)\s*```'
    markdown_match = re.search(markdown_pattern, text, re.DOTALL | re.IGNORECASE)
    if markdown_match:
        text = markdown_match.group(1).strip()
    
    # Find SVG content
    svg_pattern = r'(<svg[^>]*>.*?</svg>)'
    svg_match = re.search(svg_pattern, text, re.DOTALL | re.IGNORECASE)
    
    if svg_match:
        return svg_match.group(1)
    
    # If no match found but the text starts with <svg, return as is
    if text.startswith('<svg'):
        return text
    
    return None

