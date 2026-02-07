#!/bin/bash

# Install JuiceFS systemd service for Math2Visual
# This script creates a customized service file from the template

set -e

echo "🔧 Installing JuiceFS systemd service for Math2Visual..."

# Get script directory and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"

# Detect current user and environment
CURRENT_USER="$(whoami)"
CURRENT_GROUP="$(id -gn)"
CURRENT_HOME="$HOME"

echo "📋 Detected Configuration:"
echo "   User: $CURRENT_USER"
echo "   Group: $CURRENT_GROUP"
echo "   Home: $CURRENT_HOME"
echo "   Backend Directory: $BACKEND_DIR"

# Check if .env file exists
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at: $ENV_FILE"
    echo "   Please create the .env file with JuiceFS configuration first"
    exit 1
fi

# Source .env to get mount point
source "$ENV_FILE"

# Set default mount point if not specified
JUICEFS_MOUNT_POINT=${JUICEFS_MOUNT_POINT:-"/mnt/juicefs"}

echo "   Mount Point: $JUICEFS_MOUNT_POINT"

# Pre-create mount point to avoid sudo issues during service startup
echo ""
echo "📁 Pre-creating mount point..."
if [ ! -d "$JUICEFS_MOUNT_POINT" ]; then
    echo "   Creating: $JUICEFS_MOUNT_POINT"
    if [ -w "$(dirname "$JUICEFS_MOUNT_POINT")" ]; then
        mkdir -p "$JUICEFS_MOUNT_POINT"
    else
        echo "   (Requires sudo for /mnt directory)"
        sudo mkdir -p "$JUICEFS_MOUNT_POINT"
        sudo chown "$CURRENT_USER:$CURRENT_GROUP" "$JUICEFS_MOUNT_POINT"
    fi
    echo "✅ Mount point created with proper permissions"
else
    echo "✅ Mount point already exists: $JUICEFS_MOUNT_POINT"
fi

# Check if template exists
TEMPLATE_FILE="$SCRIPT_DIR/juicefs-math2visual.service.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Service template not found at: $TEMPLATE_FILE"
    exit 1
fi

# Generate service file from template
SERVICE_FILE="$SCRIPT_DIR/juicefs-math2visual.service"

echo ""
echo "🔨 Generating service file from template..."

# Use sed to replace placeholders
sed -e "s|{{MATH2VISUAL_USER}}|$CURRENT_USER|g" \
    -e "s|{{MATH2VISUAL_GROUP}}|$CURRENT_GROUP|g" \
    -e "s|{{MATH2VISUAL_HOME}}|$CURRENT_HOME|g" \
    -e "s|{{MATH2VISUAL_BACKEND_DIR}}|$BACKEND_DIR|g" \
    -e "s|{{JUICEFS_MOUNT_POINT}}|$JUICEFS_MOUNT_POINT|g" \
    "$TEMPLATE_FILE" > "$SERVICE_FILE"

echo "✅ Generated service file: $SERVICE_FILE"

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

# Install the service
echo ""
echo "📦 Installing systemd service..."

# Copy service file to systemd directory
if sudo cp "$SERVICE_FILE" /etc/systemd/system/; then
    echo "✅ Service file copied to /etc/systemd/system/"
else
    echo "❌ Failed to copy service file"
    exit 1
fi

# Reload systemd daemon
if sudo systemctl daemon-reload; then
    echo "✅ Systemd daemon reloaded"
else
    echo "❌ Failed to reload systemd daemon"
    exit 1
fi

# Enable the service
if sudo systemctl enable juicefs-math2visual.service; then
    echo "✅ Service enabled for automatic startup"
else
    echo "❌ Failed to enable service"
    exit 1
fi

echo ""
echo "🎉 JuiceFS systemd service installed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Test the service:"
echo "      sudo systemctl start juicefs-math2visual.service"
echo "      systemctl status juicefs-math2visual.service"
echo ""
echo "   2. Verify the mount:"
echo "      mountpoint $JUICEFS_MOUNT_POINT"
echo ""
echo "   3. The service will automatically start on boot"
echo ""
echo "🔧 Management commands:"
echo "   Start:   sudo systemctl start juicefs-math2visual.service"
echo "   Stop:    sudo systemctl stop juicefs-math2visual.service"
echo "   Status:  systemctl status juicefs-math2visual.service"
echo "   Logs:    journalctl -u juicefs-math2visual.service"
echo "   Disable: sudo systemctl disable juicefs-math2visual.service"

# Clean up generated service file (keep template)
rm -f "$SERVICE_FILE"
echo ""
echo "✨ Installation complete!"
