#!/bin/bash
set -e

# Function to safely run commands that might fail
safe_run() {
    "$@" 2>/dev/null || true
}

# Ensure storage directories exist and have correct permissions
# This is important when storage is mounted as a volume
echo "Setting up storage directories..."
mkdir -p /app/storage/output /app/storage/temp_svgs /app/storage/analytics /app/storage/datasets/svg_dataset

# Ensure dataset exists (download from GitHub if needed)
echo "Ensuring SVG dataset is available..."
/ensure-dataset.sh

# Set permissions (chown may fail with volume mounts, so we continue anyway)
# Note: dataset directory needs write access for user uploads
safe_run chown -R appuser:appuser /app/storage || echo "Note: Could not change ownership (may be due to volume mount)"
safe_run chmod -R 755 /app/storage
# Ensure dataset directory is writable for user uploads
safe_run chmod -R 775 /app/storage/datasets/svg_dataset || true

# Verify dataset is accessible to appuser
if su appuser -c "test -r /app/storage/datasets/svg_dataset" 2>/dev/null; then
    echo "✓ appuser has read access to dataset directory"
    svg_count_user=$(su appuser -c "find /app/storage/datasets/svg_dataset -name '*.svg' 2>/dev/null | wc -l" 2>/dev/null || echo "0")
    echo "  appuser can see $svg_count_user SVG files"
else
    echo "⚠️  WARNING: appuser does NOT have read access to dataset directory"
    echo "  Attempting to fix permissions..."
    safe_run chmod -R o+rX /app/storage/datasets
    safe_run chown -R appuser:appuser /app/storage/datasets || echo "  Note: Could not change ownership (volume mount restrictions)"
fi

# Log ClamAV connection settings and perform a lightweight connectivity check (non-fatal)
echo "Checking ClamAV configuration..."
CLAMAV_HOST="${CLAMAV_HOST:-localhost}"
CLAMAV_PORT="${CLAMAV_PORT:-3310}"
echo "  CLAMAV_HOST=${CLAMAV_HOST}"
echo "  CLAMAV_PORT=${CLAMAV_PORT}"

python - << 'EOF' || echo "  Note: ClamAV connection check failed (antivirus scanning will gracefully fall back if unavailable)."
import os
import socket

host = os.getenv("CLAMAV_HOST", "localhost")
port = int(os.getenv("CLAMAV_PORT", "3310"))

s = socket.socket()
s.settimeout(2)
try:
    result = s.connect_ex((host, port))
    if result == 0:
        print(f"  ✓ ClamAV daemon reachable at {host}:{port}")
    else:
        print(f"  ⚠️  ClamAV daemon not reachable at {host}:{port} (code={result})")
finally:
    s.close()
EOF

# Ensure Nginx uses the Math2Visual config and not the distro default
echo "Ensuring Nginx is using Math2Visual configuration..."
# Some base images ship with a default site in sites-enabled that serves the 'Welcome to nginx!' page.
# We disable that here and rely solely on /etc/nginx/conf.d/default.conf.
if [ -f /etc/nginx/sites-enabled/default ] || [ -f /etc/nginx/sites-available/default ]; then
    echo "  Disabling default Nginx site..."
    safe_run rm -f /etc/nginx/sites-enabled/default
    safe_run rm -f /etc/nginx/sites-available/default
fi

# Also comment out any sites-enabled included in the main nginx.conf so only conf.d is used.
if grep -q "sites-enabled" /etc/nginx/nginx.conf 2>/dev/null; then
    echo "  Removing 'sites-enabled' include from nginx.conf..."
    safe_run sed -i 's@include /etc/nginx/sites-enabled/\\*;@# include /etc/nginx/sites-enabled/*;@' /etc/nginx/nginx.conf
fi

# Start Gunicorn in the background as appuser
echo "Starting Flask backend..."
cd /app

# Verify gunicorn exists
if [ ! -f /home/appuser/.local/bin/gunicorn ]; then
    echo "ERROR: gunicorn not found at /home/appuser/.local/bin/gunicorn"
    echo "Checking if gunicorn is installed..."
    su appuser -c "which gunicorn || echo 'gunicorn not in PATH'"
    exit 1
fi

# Use full path to gunicorn and run as appuser with proper shell
echo "Starting gunicorn as appuser..."
su appuser -s /bin/bash -c "cd /app && /home/appuser/.local/bin/gunicorn --config gunicorn.conf.py wsgi:app" 2>&1 &
GUNICORN_PID=$!

# Function to handle shutdown
cleanup() {
    echo "Shutting down..."
    kill $GUNICORN_PID 2>/dev/null || true
    nginx -s quit
    exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for Gunicorn to be ready
echo "Waiting for Gunicorn to start..."
GUNICORN_READY=0
for i in {1..30}; do
    if python -c "import socket; s = socket.socket(); s.settimeout(1); result = s.connect_ex(('127.0.0.1', 5000)); s.close(); exit(0 if result == 0 else 1)" 2>/dev/null; then
        echo "Gunicorn is ready!"
        GUNICORN_READY=1
        break
    fi
    sleep 1
done

if [ $GUNICORN_READY -eq 0 ]; then
    echo "ERROR: Gunicorn did not start within 30 seconds."
    echo "Checking gunicorn process..."
    ps aux | grep gunicorn || echo "No gunicorn process found"
    echo "Check logs with: docker compose logs app"
    exit 1
fi

# Start Nginx in the foreground (runs as root)
echo "Starting Nginx..."
exec nginx -g "daemon off;"
