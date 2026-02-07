#!/bin/bash

# JuiceFS Mount Script for Math2Visual
# This script mounts the JuiceFS filesystem

set -e

echo "🔗 Mounting JuiceFS filesystem for Math2Visual..."

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env file with JuiceFS configuration"
    exit 1
fi

source "$ENV_FILE"

# Set defaults if not provided
JUICEFS_FILESYSTEM_NAME=${JUICEFS_FILESYSTEM_NAME:-"math2visual-fs"}
JUICEFS_MOUNT_POINT=${JUICEFS_MOUNT_POINT:-"/mnt/juicefs"}
JUICEFS_CACHE_DIR=${JUICEFS_CACHE_DIR:-"/var/cache/juicefs"}
JUICEFS_LOG_DIR=${JUICEFS_LOG_DIR:-"/var/log/juicefs"}

echo "📋 Mount Configuration:"
echo "   Filesystem: $JUICEFS_FILESYSTEM_NAME"
echo "   Mount Point: $JUICEFS_MOUNT_POINT"
echo "   Cache Directory: $JUICEFS_CACHE_DIR"

# Check if already mounted
if mountpoint -q "$JUICEFS_MOUNT_POINT" 2>/dev/null; then
    echo "⚠️  JuiceFS is already mounted at $JUICEFS_MOUNT_POINT"
    
    # Check if it's healthy
    if [ -w "$JUICEFS_MOUNT_POINT" ]; then
        echo "✅ Mount is healthy and writable"
        exit 0
    else
        echo "❌ Mount exists but is not writable, attempting remount..."
        fusermount -u "$JUICEFS_MOUNT_POINT" 2>/dev/null || sudo umount "$JUICEFS_MOUNT_POINT" || true
    fi
fi

# Check if filesystem exists
echo ""
echo "🔍 Checking filesystem status..."
if ! juicefs status "$JUICEFS_METADATA_URL" &> /dev/null; then
    echo "❌ Filesystem '$JUICEFS_FILESYSTEM_NAME' not found"
    echo "   Please run: ./scripts/format_juicefs.sh"
    exit 1
fi
echo "✅ Filesystem '$JUICEFS_FILESYSTEM_NAME' is ready"

# Create mount point if it doesn't exist
if [ ! -d "$JUICEFS_MOUNT_POINT" ]; then
    echo "📁 Creating mount point: $JUICEFS_MOUNT_POINT"
    if [ -w "$(dirname "$JUICEFS_MOUNT_POINT")" ]; then
        mkdir -p "$JUICEFS_MOUNT_POINT"
    else
        echo "⚠️  Need sudo to create mount point in $(dirname "$JUICEFS_MOUNT_POINT")"
        # Check if we're running in a non-interactive environment (like systemd)
        if [ -z "$PS1" ] && [ ! -t 0 ]; then
            echo "❌ Cannot create mount point in non-interactive environment"
            echo "   Please run: sudo mkdir -p '$JUICEFS_MOUNT_POINT' && sudo chown '$USER:$USER' '$JUICEFS_MOUNT_POINT'"
            echo "   Or reinstall the service: ./scripts/install_systemd_service.sh"
            exit 1
        fi
        sudo mkdir -p "$JUICEFS_MOUNT_POINT"
        sudo chown -R "$USER:$USER" "$JUICEFS_MOUNT_POINT"
    fi
else
    echo "📁 Mount point already exists: $JUICEFS_MOUNT_POINT"
fi

# Ensure user owns the mount point (only if needed)
if [ ! -w "$JUICEFS_MOUNT_POINT" ]; then
    echo "📁 Fixing mount point permissions..."
    sudo chown -R "$USER:$USER" "$JUICEFS_MOUNT_POINT"
else
    echo "✅ Mount point permissions are correct"
fi

# Create log directory
if [ ! -d "$JUICEFS_LOG_DIR" ]; then
    echo "📁 Creating log directory: $JUICEFS_LOG_DIR"
    if [ -w "$(dirname "$JUICEFS_LOG_DIR")" ]; then
        mkdir -p "$JUICEFS_LOG_DIR"
    else
        echo "⚠️  Need sudo to create log directory in $(dirname "$JUICEFS_LOG_DIR")"
        sudo mkdir -p "$JUICEFS_LOG_DIR"
        sudo chown -R "$USER:$USER" "$JUICEFS_LOG_DIR"
    fi
else
    echo "📁 Log directory already exists: $JUICEFS_LOG_DIR"
fi

# Create cache directory
if [ ! -d "$JUICEFS_CACHE_DIR" ]; then
    echo "📁 Creating cache directory: $JUICEFS_CACHE_DIR"
    if [ -w "$(dirname "$JUICEFS_CACHE_DIR")" ]; then
        mkdir -p "$JUICEFS_CACHE_DIR"
    else
        echo "⚠️  Need sudo to create cache directory in $(dirname "$JUICEFS_CACHE_DIR")"
        sudo mkdir -p "$JUICEFS_CACHE_DIR"
        sudo chown -R "$USER:$USER" "$JUICEFS_CACHE_DIR"
    fi
else
    echo "📁 Cache directory already exists: $JUICEFS_CACHE_DIR"
fi

# Mount with optimized settings for SVG files
echo ""
echo "🔗 Mounting filesystem..."

MOUNT_CMD="juicefs mount \
    --cache-dir $JUICEFS_CACHE_DIR \
    --cache-size 1024 \
    --free-space-ratio 0.1 \
    --buffer-size 300 \
    --prefetch 1 \
    --writeback \
    -d"

# Add metadata URL and mount point (use metadata URL, not filesystem name)
MOUNT_CMD="$MOUNT_CMD '$JUICEFS_METADATA_URL' '$JUICEFS_MOUNT_POINT'"

echo "Running: $MOUNT_CMD"
echo ""

if eval $MOUNT_CMD; then
    # Wait a moment for mount to be ready
    sleep 2
    
    # Verify mount
    if mountpoint -q "$JUICEFS_MOUNT_POINT" 2>/dev/null; then
        echo "✅ JuiceFS mounted successfully at $JUICEFS_MOUNT_POINT"
        
        # Test write access
        TEST_FILE="$JUICEFS_MOUNT_POINT/.write_test"
        if echo "test" > "$TEST_FILE" 2>/dev/null && rm "$TEST_FILE" 2>/dev/null; then
            echo "✅ Mount is writable and healthy"
        else
            echo "❌ Mount is not writable"
            exit 1
        fi
        
        # Show mount info
        echo ""
        echo "📊 Mount Information:"
        df -h "$JUICEFS_MOUNT_POINT" 2>/dev/null || true
        
        echo ""
        echo "🎉 JuiceFS is ready!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Migrate SVG files: cp -r svg_dataset/* /mnt/juicefs/svg_dataset/"
        echo "   2. Update backend configuration to use: $JUICEFS_MOUNT_POINT/svg_dataset"
        echo "   3. Test the application"
        
    else
        echo "❌ Mount failed - filesystem not accessible"
        exit 1
    fi
else
    echo "❌ Failed to mount JuiceFS filesystem"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check if FUSE is available: ls -la /dev/fuse"
    echo "   - Check if user is in fuse group: groups $USER"
    echo "   - Check logs: journalctl -u juicefs"
    echo "   - Verify filesystem: juicefs status \"$JUICEFS_FILESYSTEM_NAME\""
    exit 1
fi
