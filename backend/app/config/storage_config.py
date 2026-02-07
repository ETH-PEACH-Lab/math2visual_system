"""
Storage configuration management for Math2Visual
Handles different storage backends (local, JuiceFS, etc.)
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class StorageConfig:
    """Configuration manager for SVG storage backends."""
    
    def __init__(self):
        self.storage_mode = os.getenv('SVG_STORAGE_MODE', 'local')
        self.local_svg_path = os.getenv('SVG_DATASET_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage/datasets/svg_dataset"))
        self.juicefs_svg_path = os.getenv('SVG_DATASET_PATH', '/mnt/juicefs/svg_dataset')
        self.cache_size = int(os.getenv('SVG_CACHE_SIZE', '100'))
    
    @property
    def svg_dataset_path(self) -> str:
        """Get the appropriate SVG dataset path based on storage mode."""
        if self.storage_mode == 'juicefs':
            return self.juicefs_svg_path
        elif self.storage_mode == 'local':
            return self.local_svg_path
        else:
            # Default to local if mode is unknown
            return self.local_svg_path
    
    @property
    def upload_path(self) -> str:
        """Get the path where uploaded SVGs should be stored."""
        return self.svg_dataset_path
    
    def is_juicefs_enabled(self) -> bool:
        """Check if JuiceFS is enabled and available."""
        if self.storage_mode != 'juicefs':
            return False
        
        # Check if JuiceFS mount is available
        return os.path.ismount('/mnt/juicefs') and os.path.exists(self.juicefs_svg_path)
    
    def validate_storage(self) -> tuple[bool, Optional[str]]:
        """Validate that the configured storage is available."""
        svg_path = self.svg_dataset_path
        
        if not os.path.exists(svg_path):
            return False, f"SVG dataset path does not exist: {svg_path}"
        
        if not os.access(svg_path, os.R_OK):
            return False, f"No read access to SVG dataset path: {svg_path}"
        
        if self.storage_mode == 'juicefs' and not os.path.ismount('/mnt/juicefs'):
            return False, "JuiceFS is not mounted at /mnt/juicefs"
        
        return True, None
    
    def get_storage_info(self) -> dict:
        """Get storage configuration information."""
        is_valid, error = self.validate_storage()
        
        return {
            'storage_mode': self.storage_mode,
            'svg_dataset_path': self.svg_dataset_path,
            'upload_path': self.upload_path,
            'cache_size': self.cache_size,
            'is_juicefs_enabled': self.is_juicefs_enabled(),
            'is_valid': is_valid,
            'error': error,
            'juicefs_mounted': os.path.ismount('/mnt/juicefs') if os.path.exists('/mnt/juicefs') else False
        }


# Global storage configuration instance
storage_config = StorageConfig()


def get_svg_dataset_path() -> str:
    """Get the current SVG dataset path."""
    return storage_config.svg_dataset_path


def get_upload_path() -> str:
    """Get the path for SVG uploads."""
    return storage_config.upload_path


def validate_storage_config() -> tuple[bool, Optional[str]]:
    """Validate the current storage configuration."""
    return storage_config.validate_storage()
