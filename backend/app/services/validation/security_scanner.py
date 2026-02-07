"""
ClamAV Scanner Module with Graceful Fallback

This module provides virus scanning capabilities using ClamAV daemon (clamd)
with graceful fallback when ClamAV is not available or configured.
"""

import logging
import tempfile
import os
from typing import Tuple, Optional
from dataclasses import dataclass

# ClamAV python library - optional dependency
try:
    import pyclamd
    PYCLAMD_AVAILABLE = True
except ImportError:
    PYCLAMD_AVAILABLE = False
    pyclamd = None

logger = logging.getLogger(__name__)


@dataclass
class ScanResult:
    """Result of antivirus scan."""
    is_clean: bool
    threat_found: Optional[str] = None
    scan_performed: bool = True
    scanner_available: bool = True
    error_message: Optional[str] = None


class ClamAVScanner:
    """
    ClamAV virus scanner with graceful fallback capabilities.
    
    This scanner will:
    1. Attempt to connect to ClamAV daemon
    2. Fall back gracefully if ClamAV is unavailable
    3. Provide detailed scan results and availability status
    """
    
    def __init__(self, socket_path: Optional[str] = None, host: str = 'localhost', port: int = 3310):
        """
        Initialize ClamAV scanner.
        
        Args:
            socket_path: Path to ClamAV unix socket (preferred)
            host: ClamAV daemon host (fallback)
            port: ClamAV daemon port (fallback)
        """
        self.socket_path = socket_path
        self.host = host
        self.port = port
        self._connection = None
        self._availability_checked = False
        self._is_available = False
        self._last_error = None
        self._using_network_socket = False  # Track if we're using network vs Unix socket
    
    def _check_availability(self) -> bool:
        """
        Check if ClamAV is available and accessible.
        
        Returns:
            True if ClamAV is available, False otherwise
        """
        if self._availability_checked:
            return self._is_available
        
        self._availability_checked = True
        
        if not PYCLAMD_AVAILABLE:
            self._last_error = "pyclamd library not installed"
            logger.info("ClamAV not available: pyclamd library not installed")
            return False
        
        try:
            # Try to create connection
            if self.socket_path and os.path.exists(self.socket_path):
                cd = pyclamd.ClamdUnixSocket(self.socket_path)
                self._using_network_socket = False
            else:
                cd = pyclamd.ClamdNetworkSocket(self.host, self.port)
                self._using_network_socket = True
            
            # Test connection with ping
            if cd.ping():
                self._connection = cd
                self._is_available = True
                logger.info(f"ClamAV available at {self.socket_path or f'{self.host}:{self.port}'}")
                return True
            else:
                self._last_error = "ClamAV daemon not responding to ping"
                logger.warning("ClamAV daemon not responding to ping")
                return False
                
        except Exception as e:
            self._last_error = f"Failed to connect to ClamAV: {str(e)}"
            logger.warning(f"ClamAV not available: {str(e)}")
            return False
    
    def get_version_info(self) -> Optional[str]:
        """
        Get ClamAV version information.
        
        Returns:
            Version string if available, None otherwise
        """
        if not self._check_availability():
            return None
        
        try:
            return self._connection.version()
        except Exception as e:
            logger.warning(f"Failed to get ClamAV version: {str(e)}")
            return None
    
    def _process_scan_result(self, scan_result, filename_hint: str, file_path: Optional[str] = None) -> ScanResult:
        """
        Process ClamAV scan result and return ScanResult.
        
        Args:
            scan_result: Result from scan_stream() or scan_file()
            filename_hint: Filename for logging
            file_path: File path (for file scan results, None for stream scan)
            
        Returns:
            ScanResult with scan details
        """
        if scan_result is None or scan_result == "OK":
            return ScanResult(is_clean=True, scan_performed=True, scanner_available=True)
        
        # Extract threat name based on result type
        threat_name = None
        if isinstance(scan_result, tuple) and len(scan_result) >= 2:
            threat_name = scan_result[1]  # Stream scan: (status, threat_name)
        elif isinstance(scan_result, dict) and file_path and file_path in scan_result:
            threat_info = scan_result[file_path]  # File scan: {path: threat_info}
            threat_name = threat_info[1] if isinstance(threat_info, tuple) and len(threat_info) >= 2 else str(threat_info)
        
        if threat_name:
            logger.warning(f"Threat detected in {filename_hint}: {threat_name}")
            return ScanResult(
                is_clean=False,
                threat_found=threat_name,
                scan_performed=True,
                scanner_available=True
            )
        
        # Unexpected result format
        logger.warning(f"Unexpected scan result format: {scan_result}")
        return ScanResult(
            is_clean=True,
            scan_performed=True,
            scanner_available=True,
            error_message=f"Unexpected scan result format: {scan_result}"
        )
    
    def scan_content(self, content: bytes, filename_hint: str = "unknown") -> ScanResult:
        """
        Scan file content for viruses.
        
        Uses stream scanning when ClamAV is accessed over network (Docker containers),
        falls back to file scanning when using Unix socket (same host).
        
        Args:
            content: File content as bytes
            filename_hint: Filename for logging purposes
            
        Returns:
            ScanResult with scan details
        """
        if not self._check_availability():
            return ScanResult(
                is_clean=True,
                scan_performed=False,
                scanner_available=False,
                error_message=self._last_error
            )
        
        try:
            if self._using_network_socket:
                # Stream scanning: send content directly over network (works across containers)
                scan_result = self._connection.scan_stream(content)
                return self._process_scan_result(scan_result, filename_hint)
            else:
                # File scanning: use temporary file (works when ClamAV is on same host)
                with tempfile.NamedTemporaryFile(delete=False, dir='/tmp', prefix='clamav_scan_') as temp_file:
                    temp_file.write(content)
                    temp_file.flush()
                    temp_path = temp_file.name
                
                os.chmod(temp_path, 0o644)
                try:
                    scan_result = self._connection.scan_file(temp_path)
                    return self._process_scan_result(scan_result, filename_hint, temp_path)
                finally:
                    try:
                        os.unlink(temp_path)
                    except Exception:
                        pass
        except Exception as e:
            scan_type = "stream" if self._using_network_socket else "file"
            logger.error(f"Error during ClamAV {scan_type} scan of {filename_hint}: {str(e)}")
            return ScanResult(
                is_clean=True,
                scan_performed=False,
                scanner_available=True,
                error_message=f"{scan_type.capitalize()} scan error: {str(e)}"
            )
    
    def get_status(self) -> dict:
        """
        Get scanner status information.
        
        Returns:
            Dictionary with scanner status details
        """
        is_available = self._check_availability()
        
        status = {
            'scanner_available': is_available,
            'pyclamd_installed': PYCLAMD_AVAILABLE,
            'connection_method': 'socket' if self.socket_path else 'network',
            'connection_target': self.socket_path or f'{self.host}:{self.port}'
        }
        
        if not is_available:
            status['error'] = self._last_error
        else:
            version = self.get_version_info()
            if version:
                status['clamav_version'] = version
        
        return status


# Global scanner instance with common configurations
_scanner_instance = None

def get_clamav_scanner() -> ClamAVScanner:
    """
    Get shared ClamAV scanner instance.
    
    Returns:
        ClamAV scanner instance
    """
    global _scanner_instance
    
    if _scanner_instance is None:
        # Try common ClamAV socket paths
        socket_paths = [
            '/var/run/clamav/clamd.ctl',  # Debian/Ubuntu
            '/var/run/clamd.scan/clamd.sock',  # CentOS/RHEL
            '/tmp/clamd.socket',  # Custom/development
        ]
        
        socket_path = None
        for path in socket_paths:
            if os.path.exists(path):
                socket_path = path
                break
        
        # Allow overriding host/port via environment variables (useful in Docker)
        clamav_host = os.getenv("CLAMAV_HOST", "localhost")
        try:
            clamav_port = int(os.getenv("CLAMAV_PORT", "3310"))
        except ValueError:
            clamav_port = 3310

        _scanner_instance = ClamAVScanner(
            socket_path=socket_path,
            host=clamav_host,
            port=clamav_port,
        )
    
    return _scanner_instance


def scan_file_content(content: bytes, filename: str = "unknown") -> ScanResult:
    """
    Convenience function to scan file content.
    
    Args:
        content: File content as bytes
        filename: Filename for logging
        
    Returns:
        ScanResult
    """
    scanner = get_clamav_scanner()
    return scanner.scan_content(content, filename)


def is_clamav_available() -> bool:
    """
    Check if ClamAV is available.
    
    Returns:
        True if ClamAV is available and functional
    """
    scanner = get_clamav_scanner()
    return scanner._check_availability()


def get_clamav_status() -> dict:
    """
    Get ClamAV status information.
    
    Returns:
        Status dictionary
    """
    scanner = get_clamav_scanner()
    return scanner.get_status()
