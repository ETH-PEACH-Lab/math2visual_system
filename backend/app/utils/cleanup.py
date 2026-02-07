"""
Utility module for cleaning up temporary files and managing storage.
"""
import os
import time
import glob
import re
from typing import Optional, Set, Tuple


class FileCleanupManager:
    """
    Manages cleanup of temporary files based on age and patterns.
    """
    
    def __init__(self, 
        output_dir: str, 
        max_age_hours: int = 24,
        cleanup_patterns: Optional[list] = None,
        include_archives: bool = False):
        """
        Initialize cleanup manager.
        
        Args:
            output_dir: Directory to clean up
            max_age_hours: Maximum age of files before cleanup (default: 24 hours)
            cleanup_patterns: File patterns to clean up (default: common temp patterns)
            include_archives: Whether to include archive files in cleanup (default: False)
        """
        self.output_dir = output_dir
        self.max_age_seconds = max_age_hours * 3600
        
        if cleanup_patterns is None:
            # Normal patterns for temporary files (UUID-based names only, no timestamps)
            self.normal_patterns = [
                "formal_*-*-*-*-*.svg",    # Temporary formal files (formal_{uuid}.svg) - UUID has 4 hyphens
                "intuitive_*-*-*-*-*.svg", # Temporary intuitive files (intuitive_{uuid}.svg) - UUID has 4 hyphens
            ]
            
            # Archive patterns for timestamped files (only if requested)
            self.archive_patterns = [
                "formal_*_*-*-*-*-*.svg",    # Archive formal files (formal_{timestamp}_{uuid}.svg)
                "intuitive_*_*-*-*-*-*.svg", # Archive intuitive files (intuitive_{timestamp}_{uuid}.svg)
            ] if include_archives else []
            
            # Maintain combined patterns list for code that accesses it directly
            # (e.g., cleanup script dry-run mode). Note: actual cleanup uses
            # normal_patterns and archive_patterns separately for mutual exclusivity.
            self.cleanup_patterns = self.normal_patterns + self.archive_patterns
        else:
            self.cleanup_patterns = cleanup_patterns
            # If custom patterns provided, treat all as normal patterns
            self.normal_patterns = cleanup_patterns
            self.archive_patterns = []
    
    def _is_archive_file(self, filename: str) -> bool:
        """
        Check if a filename matches the archive format (has timestamp before UUID).
        
        Archive format: {type}_{timestamp}_{uuid}.svg
        Normal format: {type}_{uuid}.svg
        
        Args:
            filename: Name of the file (without directory)
            
        Returns:
            True if file is an archive file, False otherwise
        """
        # Archive files have format: formal_YYYYMMDDHHMMSS_uuid.svg or intuitive_YYYYMMDDHHMMSS_uuid.svg
        # We detect this by checking if there's an underscore followed by digits, then another underscore, then UUID
        archive_regex = r'^(formal|intuitive)_\d+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.svg$'
        return bool(re.match(archive_regex, filename))
    
    def _is_normal_file(self, filename: str) -> bool:
        """
        Check if a filename matches the normal format (UUID only, no timestamp).
        
        Normal format: {type}_{uuid}.svg
        
        Args:
            filename: Name of the file (without directory)
            
        Returns:
            True if file is a normal file, False otherwise
        """
        # Normal files have format: formal_uuid.svg or intuitive_uuid.svg
        # UUID format: 8-4-4-4-12 hex characters
        normal_regex = r'^(formal|intuitive)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.svg$'
        return bool(re.match(normal_regex, filename))
    
    def get_file_age_seconds(self, filepath: str) -> Optional[float]:
        """
        Get the age of a file in seconds.
        
        Args:
            filepath: Path to the file
            
        Returns:
            Age in seconds, or None if file doesn't exist or can't be accessed
        """
        try:
            if not os.path.exists(filepath):
                return None
            
            file_time = os.path.getmtime(filepath)
            current_time = time.time()
            return current_time - file_time
        except (OSError, IOError):
            return None
    
    def should_cleanup_file(self, filepath: str) -> bool:
        """
        Determine if a file should be cleaned up based on age.
        
        Args:
            filepath: Path to the file
            
        Returns:
            True if file should be cleaned up, False otherwise
        """
        age = self.get_file_age_seconds(filepath)
        if age is None:
            return False
        
        return age > self.max_age_seconds
    
    def _get_matching_files(self) -> Tuple[Set[str], Set[str]]:
        """
        Get all matching files, separated into archive and normal files.
        Uses regex classification for mutual exclusivity by design.
        If custom patterns are provided (not default formal/intuitive patterns),
        returns all matching files without regex filtering.
        
        Returns:
            Tuple of (archive_files, normal_files) sets
        """
        if not os.path.exists(self.output_dir):
            return set(), set()
        
        archive_files: Set[str] = set()
        normal_files: Set[str] = set()
        
        # Collect all potential files using all patterns
        all_potential_files: Set[str] = set()
        for pattern in self.cleanup_patterns:
            search_pattern = os.path.join(self.output_dir, pattern)
            for filepath in glob.glob(search_pattern):
                if os.path.isfile(filepath):
                    all_potential_files.add(filepath)
        
        # If using custom patterns (not default formal/intuitive patterns),
        # don't filter by regex - just return all matching files as "normal"
        # This handles cases like temp_svgs where we want to clean ALL files matching the pattern
        default_normal_patterns = ["formal_*-*-*-*-*.svg", "intuitive_*-*-*-*-*.svg"]
        is_custom_patterns = (
            not self.archive_patterns and  # No archive patterns
            self.normal_patterns != default_normal_patterns  # Not using default patterns
        )
        
        if is_custom_patterns:
            # Custom patterns provided (e.g., ["*.svg"] for temp_svgs)
            # Return all matching files without regex filtering
            return set(), all_potential_files
        
        # For default patterns, classify using regex (mutually exclusive by design)
        for filepath in all_potential_files:
            filename = os.path.basename(filepath)
            
            # Archive files: check first (more specific pattern)
            if self._is_archive_file(filename):
                if self.archive_patterns:  # Only include if archives are enabled
                    archive_files.add(filepath)
                continue
            
            # Normal files: check second
            if self._is_normal_file(filename):
                normal_files.add(filepath)
        
        return archive_files, normal_files
    
    def cleanup_old_files(self) -> dict:
        """
        Clean up old temporary files matching the configured patterns.
        Patterns are processed in order: archive patterns first, then normal patterns,
        ensuring mutual exclusivity (files match only one pattern type).
        
        Returns:
            Dictionary with cleanup statistics
        """
        stats = {
            "files_found": 0,
            "files_cleaned": 0,
            "errors": 0,
            "cleaned_files": []
        }
        
        archive_files, normal_files = self._get_matching_files()
        all_files = archive_files | normal_files
        
        for filepath in all_files:
            # Ensure we only process files, not directories
            if not os.path.isfile(filepath):
                continue
            
            stats["files_found"] += 1
            try:
                if self.should_cleanup_file(filepath):
                    os.remove(filepath)
                    stats["files_cleaned"] += 1
                    stats["cleaned_files"].append(filepath)
                    print(f"Cleaned up old file: {filepath}")
            except (OSError, IOError) as e:
                stats["errors"] += 1
                print(f"Error cleaning up file {filepath}: {e}")
        
        return stats
    
    def get_storage_stats(self) -> dict:
        """
        Get statistics about storage usage in the output directory.
        Only counts files that match the cleanup patterns for consistency.
        Ensures mutual exclusivity between archive and normal patterns.
        
        Returns:
            Dictionary with storage statistics
        """
        stats = {
            "total_files": 0,
            "total_size_bytes": 0,
            "old_files": 0,
            "old_size_bytes": 0
        }
        
        try:
            archive_files, normal_files = self._get_matching_files()
            all_files = archive_files | normal_files
            
            for filepath in all_files:
                # Ensure we only process files, not directories
                if not os.path.isfile(filepath):
                    continue
                
                file_size = os.path.getsize(filepath)
                stats["total_files"] += 1
                stats["total_size_bytes"] += file_size
                
                if self.should_cleanup_file(filepath):
                    stats["old_files"] += 1
                    stats["old_size_bytes"] += file_size
        
        except (OSError, IOError) as e:
            print(f"Error getting storage stats: {e}")
        
        return stats


def cleanup_temp_files(output_dir: str, max_age_hours: int = 24) -> dict:
    """
    Convenience function to clean up temporary files.
    
    Args:
        output_dir: Directory to clean up
        max_age_hours: Maximum age of files before cleanup
        
    Returns:
        Cleanup statistics
    """
    manager = FileCleanupManager(output_dir, max_age_hours)
    return manager.cleanup_old_files()


def get_storage_stats(output_dir: str, max_age_hours: int = 24) -> dict:
    """
    Convenience function to get storage statistics.
    
    Args:
        output_dir: Directory to analyze
        max_age_hours: Age threshold for considering files "old"
        
    Returns:
        Storage statistics
    """
    manager = FileCleanupManager(output_dir, max_age_hours)
    return manager.get_storage_stats()
