#!/usr/bin/env python3
"""
Icon Generator Script for Math2Visual
Generates all required icon files from a source image
"""

import os
import sys
from PIL import Image, ImageDraw
import io

def create_math_calculator_icon(size):
    """Create a math calculator icon with the specified size"""
    # Create a new image with the specified size
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate proportional sizes
    border_width = max(1, size // 50)
    corner_radius = size // 8
    
    # Draw the background with rounded corners (simulated)
    draw.rectangle([0, 0, size-1, size-1], fill=(240, 240, 240), outline=(0, 0, 0), width=border_width)
    
    # Divide into 4 quadrants
    half = size // 2
    
    # Top-left quadrant (green) - Addition (+)
    draw.rectangle([border_width, border_width, half-1, half-1], fill=(76, 175, 80))
    plus_size = size // 8
    center_x, center_y = half // 2, half // 2
    draw.rectangle([center_x - plus_size//2, center_y - plus_size//4, center_x + plus_size//2, center_y + plus_size//4], fill=(0, 0, 0))
    draw.rectangle([center_x - plus_size//4, center_y - plus_size//2, center_x + plus_size//4, center_y + plus_size//2], fill=(0, 0, 0))
    
    # Top-right quadrant (blue) - Multiplication (×)
    draw.rectangle([half, border_width, size-border_width-1, half-1], fill=(33, 150, 243))
    center_x, center_y = half + half // 2, half // 2
    x_size = size // 10
    # Draw X
    draw.line([center_x - x_size, center_y - x_size, center_x + x_size, center_y + x_size], fill=(0, 0, 0), width=max(1, size//40))
    draw.line([center_x - x_size, center_y + x_size, center_x + x_size, center_y - x_size], fill=(0, 0, 0), width=max(1, size//40))
    
    # Bottom-left quadrant (yellow) - Subtraction (-)
    draw.rectangle([border_width, half, half-1, size-border_width-1], fill=(255, 235, 59))
    center_x, center_y = half // 2, half + half // 2
    minus_size = size // 8
    draw.rectangle([center_x - minus_size//2, center_y - minus_size//4, center_x + minus_size//2, center_y + minus_size//4], fill=(0, 0, 0))
    
    # Bottom-right quadrant (red) - Division (÷)
    draw.rectangle([half, half, size-border_width-1, size-border_width-1], fill=(244, 67, 54))
    center_x, center_y = half + half // 2, half + half // 2
    dot_size = max(1, size // 25)
    line_size = size // 8
    # Draw division symbol
    draw.ellipse([center_x - dot_size, center_y - line_size//2 - dot_size*2, center_x + dot_size, center_y - line_size//2], fill=(0, 0, 0))
    draw.rectangle([center_x - line_size//2, center_y - line_size//8, center_x + line_size//2, center_y + line_size//8], fill=(0, 0, 0))
    draw.ellipse([center_x - dot_size, center_y + line_size//2, center_x + dot_size, center_y + line_size//2 + dot_size*2], fill=(0, 0, 0))
    
    # Add central equals sign (orange circle)
    circle_size = size // 3
    circle_x = size // 2 - circle_size // 2
    circle_y = size // 2 - circle_size // 2
    draw.ellipse([circle_x, circle_y, circle_x + circle_size, circle_y + circle_size], fill=(255, 152, 0), outline=(0, 0, 0), width=max(1, size//50))
    
    # Draw equals sign
    equals_width = circle_size // 3
    equals_height = max(1, circle_size // 12)
    equals_spacing = circle_size // 6
    equals_x = size // 2 - equals_width // 2
    equals_y1 = size // 2 - equals_spacing // 2 - equals_height // 2
    equals_y2 = size // 2 + equals_spacing // 2 - equals_height // 2
    
    draw.rectangle([equals_x, equals_y1, equals_x + equals_width, equals_y1 + equals_height], fill=(0, 0, 0))
    draw.rectangle([equals_x, equals_y2, equals_x + equals_width, equals_y2 + equals_height], fill=(0, 0, 0))
    
    return img

def generate_all_icons():
    """Generate all required icon files"""
    
    # Icon sizes needed
    sizes = {
        'favicon-16x16.png': 16,
        'favicon-32x32.png': 32,
        'android-chrome-256x256.png': 256,
        'logo192.png': 192,
        'logo512.png': 512,
        'apple-touch-icon.png': 180,
        'math2visual-logo-400x200.png': (400, 200),  # Special case - rectangular
    }
    
    print("Generating Math2Visual icons...")
    
    # Generate PNG files
    for filename, size in sizes.items():
        if isinstance(size, tuple):
            # Handle rectangular logo
            width, height = size
            img = create_math_calculator_icon(min(width, height))
            # Create rectangular version by adding padding
            rect_img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
            x_offset = (width - img.width) // 2
            y_offset = (height - img.height) // 2
            rect_img.paste(img, (x_offset, y_offset))
            img = rect_img
        else:
            img = create_math_calculator_icon(size)
        
        img.save(filename)
        print(f"Generated {filename}")
    
    # Generate favicon.ico (contains multiple sizes)
    favicon_sizes = [16, 32, 48, 64]
    favicon_images = []
    for size in favicon_sizes:
        favicon_images.append(create_math_calculator_icon(size))
    
    favicon_images[0].save('favicon.ico', format='ICO', sizes=[(img.width, img.height) for img in favicon_images])
    print("Generated favicon.ico")
    
    # Generate SVG version
    svg_content = create_svg_icon()
    with open('math2visual-logo.svg', 'w') as f:
        f.write(svg_content)
    print("Generated math2visual-logo.svg")
    
    print("All icons generated successfully!")

def create_svg_icon():
    """Create an SVG version of the math calculator icon"""
    return '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect x="0" y="0" width="200" height="200" fill="#f0f0f0" stroke="#000" stroke-width="4" rx="25"/>
  
  <!-- Top-left quadrant (Addition - Green) -->
  <rect x="4" y="4" width="92" height="92" fill="#4CAF50"/>
  <rect x="40" y="46" width="20" height="8" fill="#000"/>
  <rect x="46" y="40" width="8" height="20" fill="#000"/>
  
  <!-- Top-right quadrant (Multiplication - Blue) -->
  <rect x="100" y="4" width="96" height="92" fill="#2196F3"/>
  <line x1="130" y1="30" x2="170" y2="70" stroke="#000" stroke-width="4"/>
  <line x1="170" y1="30" x2="130" y2="70" stroke="#000" stroke-width="4"/>
  
  <!-- Bottom-left quadrant (Subtraction - Yellow) -->
  <rect x="4" y="100" width="92" height="96" fill="#FFEB3B"/>
  <rect x="40" y="146" width="20" height="8" fill="#000"/>
  
  <!-- Bottom-right quadrant (Division - Red) -->
  <rect x="100" y="100" width="96" height="96" fill="#F44336"/>
  <circle cx="148" cy="135" r="4" fill="#000"/>
  <rect x="138" y="146" width="20" height="4" fill="#000"/>
  <circle cx="148" cy="165" r="4" fill="#000"/>
  
  <!-- Central equals sign (Orange circle) -->
  <circle cx="100" cy="100" r="35" fill="#FF9800" stroke="#000" stroke-width="3"/>
  <rect x="85" y="92" width="30" height="4" fill="#000"/>
  <rect x="85" y="104" width="30" height="4" fill="#000"/>
</svg>'''

if __name__ == "__main__":
    # Check if PIL is available
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Error: PIL (Pillow) is required. Install it with: pip install Pillow")
        sys.exit(1)
    
    generate_all_icons() 