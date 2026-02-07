#!/bin/bash

# Uninstall JuiceFS systemd service for Math2Visual
# This script removes the service and cleans up

set -e

SERVICE_NAME="juicefs-math2visual.service"

echo "🗑️  Uninstalling JuiceFS systemd service for Math2Visual..."

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    echo "❌ This script should not be run as root!"
    echo "   Please run as your regular user and it will use sudo when needed"
    exit 1
fi

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo "❌ systemctl not found. This system doesn't appear to use systemd."
    exit 1
fi

# Check if service exists
if [ ! -f "/etc/systemd/system/$SERVICE_NAME" ]; then
    echo "⚠️  Service $SERVICE_NAME is not installed"
    exit 0
fi

echo "📋 Current service status:"
systemctl status $SERVICE_NAME --no-pager || true

echo ""
echo "🛑 Stopping and disabling service..."

# Stop the service if it's running
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "   Stopping service..."
    if sudo systemctl stop $SERVICE_NAME; then
        echo "✅ Service stopped"
    else
        echo "⚠️  Failed to stop service (continuing anyway)"
    fi
else
    echo "   Service is not running"
fi

# Disable the service
if systemctl is-enabled --quiet $SERVICE_NAME; then
    echo "   Disabling service..."
    if sudo systemctl disable $SERVICE_NAME; then
        echo "✅ Service disabled"
    else
        echo "⚠️  Failed to disable service (continuing anyway)"
    fi
else
    echo "   Service is not enabled"
fi

# Remove service file
echo ""
echo "🗑️  Removing service file..."
if sudo rm -f "/etc/systemd/system/$SERVICE_NAME"; then
    echo "✅ Service file removed"
else
    echo "❌ Failed to remove service file"
    exit 1
fi

# Reload systemd daemon
echo "   Reloading systemd daemon..."
if sudo systemctl daemon-reload; then
    echo "✅ Systemd daemon reloaded"
else
    echo "❌ Failed to reload systemd daemon"
    exit 1
fi

# Check if JuiceFS is still mounted and offer to unmount
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    MOUNT_POINT=${JUICEFS_MOUNT_POINT:-"/mnt/juicefs"}
    
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        echo ""
        echo "📁 JuiceFS is still mounted at $MOUNT_POINT"
        echo "   To unmount manually: sudo fusermount -u $MOUNT_POINT"
    fi
fi

echo ""
echo "🎉 JuiceFS systemd service uninstalled successfully!"
echo ""
echo "📋 What was removed:"
echo "   ✅ Service file: /etc/systemd/system/$SERVICE_NAME"
echo "   ✅ Automatic startup disabled"
echo "   ✅ Service stopped"
echo ""
echo "📁 What remains:"
echo "   📂 JuiceFS mount (if active): $MOUNT_POINT"
echo "   📂 Project files: $BACKEND_DIR"
echo "   📂 Configuration: $ENV_FILE"
echo ""
echo "💡 To reinstall: ./scripts/install_systemd_service.sh"
