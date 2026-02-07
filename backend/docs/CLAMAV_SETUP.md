# ClamAV Antivirus Integration Setup

The Math2Visual backend includes **optional** ClamAV antivirus scanning with graceful fallback. The system works perfectly without ClamAV installed, but you can enable virus scanning for enhanced security.

## Current Status

- ✅ **Content-based validation**: Always active (XSS protection, malicious script detection)
- ❌ **ClamAV antivirus scanning**: Not installed (graceful fallback active)
- 🔧 **Fallback behavior**: System assumes files are clean when ClamAV unavailable

## Why Enable ClamAV?

- **Enhanced security**: Detect known malware patterns in uploaded SVG files
- **Compliance**: Meet security requirements for file upload systems
- **Defense in depth**: Additional layer beyond content validation

## Installation Guide

### 1. Install ClamAV Daemon

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install clamav clamav-daemon
```

**CentOS/RHEL:**
```bash
sudo yum install clamav clamav-scanner clamav-scanner-systemd
# or on newer versions:
sudo dnf install clamav clamav-scanner clamav-scanner-systemd
```

**macOS (Homebrew):**
```bash
brew install clamav
```

### 2. Install Python Library

```bash
pip install pyclamd
```

### 3. Configure ClamAV

**Start and enable the daemon:**
```bash
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon
```

**Update virus definitions:**
```bash
sudo /etc/init.d/clamav-freshclam stop
sudo freshclam
sudo /etc/init.d/clamav-freshclam start
```

### 4. Verify Installation

Check if ClamAV is working:
```bash
# Test ClamAV directly
echo "This is a test" | clamscan -

# Test via our API
curl http://localhost:5000/api/antivirus/status
```

Expected response when working:
```json
{
  "success": true,
  "antivirus": {
    "scanner_module_available": true,
    "scanner_available": true,
    "clamav_version": "ClamAV 0.103.x",
    "connection_method": "socket",
    "connection_target": "/var/run/clamav/clamd.ctl"
  }
}
```

## Configuration Options

The system automatically tries these socket paths:
- `/var/run/clamav/clamd.ctl` (Debian/Ubuntu)
- `/var/run/clamd.scan/clamd.sock` (CentOS/RHEL)
- `/tmp/clamd.socket` (Custom/development)

If socket connection fails, it tries network connection to `localhost:3310`.

## Troubleshooting

### Common Issues

**1. Permission denied accessing socket:**
```bash
sudo usermod -a -G clamav your_username
# Then restart your application
```

**2. ClamAV daemon not running:**
```bash
sudo systemctl status clamav-daemon
sudo systemctl start clamav-daemon
```

**3. Outdated virus definitions:**
```bash
sudo freshclam
sudo systemctl restart clamav-daemon
```

### Debug Information

Check system status:
```bash
# Via our API
curl http://localhost:5000/api/antivirus/status | python -m json.tool

# Direct ClamAV check
sudo clamdscan --version
```

## Security Notes

- **Graceful degradation**: If ClamAV fails, uploads still work (security through content validation)
- **Performance**: ClamAV scanning adds ~100-500ms per file
- **Updates**: Keep virus definitions current with `freshclam`
- **Logs**: ClamAV logs to syslog; check `/var/log/clamav/`

## Without ClamAV

The system provides robust security without ClamAV through:

- ✅ Filename validation (path traversal prevention)
- ✅ File size and type validation
- ✅ SVG structure validation
- ✅ Malicious content pattern detection
- ✅ XSS and script injection prevention
- ✅ CSS injection protection

ClamAV adds an additional layer for **known malware signatures**.
