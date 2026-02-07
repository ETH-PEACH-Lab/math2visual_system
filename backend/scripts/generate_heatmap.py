#!/usr/bin/env python3
"""
Heatmap Generation Script for Math2Visual Analytics

This script generates heatmaps from cursor position data and screenshots
for a specific user session. It retrieves cursor positions from the database,
loads corresponding screenshots, and creates a visual heatmap overlay.

Usage:
    python generate_heatmap.py <session_id> [options]

Example:
    python generate_heatmap.py session_mh125ayv_iywxsjnin5 --output-dir ./heatmaps
"""

import os
import sys
import argparse
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path

# Add the parent directory to the Python path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image
import seaborn as sns
from scipy import ndimage
from scipy.stats import gaussian_kde

# Database imports
from app.config.database import get_db, create_database_engine
from app.models.user_actions import UserSession, CursorPosition, Screenshot


class HeatmapGenerator:
    """Generates heatmaps from cursor position data and screenshots."""
    
    def __init__(self, output_dir: str = "./storage/analytics/heatmaps"):
        """Initialize the heatmap generator.
        
        Args:
            output_dir: Directory to save generated heatmaps
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize database connection
        create_database_engine()
        
    def get_session_data(self, session_id: str) -> Tuple[Optional[UserSession], List[CursorPosition], List[Screenshot]]:
        """Retrieve session data from the database.
        
        Args:
            session_id: The session ID to retrieve data for
            
        Returns:
            Tuple of (session, cursor_positions, screenshots)
        """
        db = next(get_db())
        try:
            # Get the session
            session = db.query(UserSession).filter(UserSession.session_id == session_id).first()
            if not session:
                print(f"❌ Session '{session_id}' not found in database")
                return None, [], []
            
            # Get cursor positions
            cursor_positions = db.query(CursorPosition).filter(
                CursorPosition.session_id == session.id
            ).order_by(CursorPosition.timestamp).all()
            
            # Get screenshots
            screenshots = db.query(Screenshot).filter(
                Screenshot.session_id == session.id
            ).order_by(Screenshot.created_at).all()
            
            print(f"✅ Found session: {session.session_id}")
            print(f"   - Cursor positions: {len(cursor_positions)}")
            print(f"   - Screenshots: {len(screenshots)}")
            
            return session, cursor_positions, screenshots
            
        finally:
            db.close()
    
    def load_screenshot(self, screenshot: Screenshot) -> Optional[np.ndarray]:
        """Load a screenshot image from file.
        
        Args:
            screenshot: Screenshot database record
            
        Returns:
            Image as numpy array, or None if loading fails
        """
        try:
            # Handle both relative and absolute paths
            if os.path.isabs(screenshot.file_path):
                image_path = Path(screenshot.file_path)
            else:
                # If relative path, assume it's relative to the backend directory
                backend_dir = Path(__file__).parent.parent
                image_path = backend_dir / screenshot.file_path
            
            if not image_path.exists():
                print(f"⚠️  Screenshot file not found: {image_path}")
                return None
                
            image = Image.open(image_path)
            return np.array(image)
            
        except Exception as e:
            print(f"❌ Error loading screenshot {screenshot.id}: {e}")
            return None
    
    def get_coordinates(self, cursor_positions: List[CursorPosition]) -> List[Tuple[float, float]]:
        """Extract cursor coordinates directly from position records.
        
        Args:
            cursor_positions: List of cursor position records
            
        Returns:
            List of (x, y) coordinates
        """
        if not cursor_positions:
            return []
        
        # Extract coordinates directly (no normalization needed for viewport-sized screenshots)
        coordinates = []
        for pos in cursor_positions:
            coordinates.append((pos.x, pos.y))
        
        return coordinates
    
    def create_heatmap_data(self, coordinates: List[Tuple[float, float]], 
                          image_width: int, image_height: int,
                          kernel_size: int = 100) -> np.ndarray:
        """Create heatmap data from coordinates.
        
        Args:
            coordinates: List of (x, y) coordinates
            image_width: Image width
            image_height: Image height
            kernel_size: Size of the Gaussian kernel for smoothing
            
        Returns:
            2D numpy array representing the heatmap
        """
        if not coordinates:
            return np.zeros((image_height, image_width))
        
        # Create a 2D histogram
        x_coords = [coord[0] for coord in coordinates]
        y_coords = [coord[1] for coord in coordinates]
        
        # Use kernel density estimation for better heatmap quality
        from scipy.stats import gaussian_kde
        
        # Create a grid for the heatmap
        x_grid = np.linspace(0, image_width, image_width)
        y_grid = np.linspace(0, image_height, image_height)
        X, Y = np.meshgrid(x_grid, y_grid)
        positions = np.vstack([X.ravel(), Y.ravel()])
        
        # Calculate kernel density estimation
        if len(x_coords) > 1:  # Need at least 2 points for KDE
            kernel = gaussian_kde(np.vstack([x_coords, y_coords]))
            heatmap = kernel(positions).reshape(image_height, image_width)
        else:
            print("❌ Not enough cursor positions for heatmap generation (need at least 2 points)")
            return None
        
        # Apply Gaussian smoothing with larger sigma for smoother blending
        if kernel_size > 0:
            sigma = kernel_size / 3  # Increased from /6 for smoother, more diffuse hotspots
            heatmap = ndimage.gaussian_filter(heatmap, sigma=sigma)
        
        # Normalize to enhance contrast
        if heatmap.max() > 0:
            heatmap = heatmap / heatmap.max()
        
        return heatmap
    
    def generate_heatmap(self, session_id: str, kernel_size: int = 100, alpha: float = 0.5) -> Optional[str]:
        """Generate a heatmap for a specific session using the oldest screenshot.
        
        Args:
            session_id: The session ID to generate heatmap for
            kernel_size: Size of Gaussian kernel for smoothing
            alpha: Transparency of heatmap overlay
            
        Returns:
            Path to saved heatmap image, or None if generation failed
        """
        print(f"\n🔍 Generating heatmap for session: {session_id}")
        
        # Get session data
        session, cursor_positions, screenshots = self.get_session_data(session_id)
        if not session or not screenshots:
            return None
        
        # Select screenshot with oldest timestamp (first in ordered list)
        selected_screenshot = screenshots[0]  # Already ordered by created_at
        print(f"📸 Using screenshot: {selected_screenshot.id} (oldest)")
        
        # Load screenshot
        image = self.load_screenshot(selected_screenshot)
        if image is None:
            return None
        
        image_height, image_width = image.shape[:2]
        print(f"📏 Image dimensions: {image_width}x{image_height}")
        
        # Extract cursor coordinates
        coordinates = self.get_coordinates(cursor_positions)
        print(f"📍 Extracted {len(coordinates)} cursor positions")
        
        # Create heatmap data
        heatmap_data = self.create_heatmap_data(coordinates, image_width, image_height, kernel_size)
        
        # Create a single overlay visualization
        fig, ax = plt.subplots(1, 1, figsize=(image_width/100, image_height/100))
        
        # Display the original screenshot
        ax.imshow(image)
        
        # Overlay the heatmap with a colormap similar to the Wikipedia example
        # Use 'jet' colormap for vibrant colors: blue (cold) -> green -> yellow -> red (hot)
        im = ax.imshow(heatmap_data, cmap='jet', alpha=alpha, interpolation='bilinear')
                
        # Remove axes and make it look like the original screenshot
        ax.axis('off')
        
        # Remove any padding/margins
        plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
        
        # Save the heatmap
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"heatmap_{session_id}_{timestamp}.png"
        output_path = self.output_dir / filename
        
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✅ Heatmap saved: {output_path}")
        return str(output_path)
    
    


def main():
    """Main function to run the heatmap generator."""
    parser = argparse.ArgumentParser(description="Generate heatmaps from cursor position data")
    parser.add_argument("session_id", help="Session ID to generate heatmap for")
    parser.add_argument("--output-dir", default="./storage/analytics/heatmaps", help="Output directory for heatmaps")
    parser.add_argument("--kernel-size", type=int, default=100, help="Gaussian kernel size for smoothing (larger = smoother)")
    parser.add_argument("--alpha", type=float, default=0.5, help="Heatmap overlay transparency (0.0-1.0)")
    
    args = parser.parse_args()
    
    # Create heatmap generator
    generator = HeatmapGenerator(args.output_dir)
    
    try:
        # Generate heatmap using oldest screenshot
        saved_path = generator.generate_heatmap(
            args.session_id,
            args.kernel_size,
            args.alpha
        )
        if saved_path:
            print(f"\n✅ Heatmap generated successfully")
        else:
            print(f"\n❌ Failed to generate heatmap")
            sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
