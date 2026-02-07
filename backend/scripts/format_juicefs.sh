#!/bin/bash

# JuiceFS Format Script for Math2Visual
# This script formats JuiceFS with PostgreSQL metadata engine

set -e

echo "🔧 Formatting JuiceFS filesystem for Math2Visual..."

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env file with JuiceFS configuration"
    echo "   Use the template: .env.juicefs.template"
    exit 1
fi

source "$ENV_FILE"

# Verify required environment variables
if [ -z "$JUICEFS_METADATA_URL" ]; then
    echo "❌ JUICEFS_METADATA_URL not set in .env file"
    exit 1
fi

if [ -z "$JUICEFS_FILESYSTEM_NAME" ]; then
    echo "⚠️  JUICEFS_FILESYSTEM_NAME not set, using default: math2visual-fs"
    JUICEFS_FILESYSTEM_NAME="math2visual-fs"
fi

if [ -z "$JUICEFS_STORAGE_TYPE" ]; then
    echo "⚠️  JUICEFS_STORAGE_TYPE not set, using default: file"
    JUICEFS_STORAGE_TYPE="file"
fi

if [ -z "$JUICEFS_BUCKET" ]; then
    echo "⚠️  JUICEFS_BUCKET not set, using default: /var/lib/juicefs"
    JUICEFS_BUCKET="/var/lib/juicefs"
fi

echo "📋 Configuration:"
echo "   Filesystem Name: $JUICEFS_FILESYSTEM_NAME"
echo "   Storage Type: $JUICEFS_STORAGE_TYPE"
echo "   Storage Bucket: $JUICEFS_BUCKET"
echo "   Metadata URL: ${JUICEFS_METADATA_URL%:*}:*****"

# Test PostgreSQL connection first
echo ""
echo "🔗 Testing PostgreSQL connection..."
if ! psql "$JUICEFS_METADATA_URL" -c "SELECT version();" &> /dev/null; then
    echo "❌ Cannot connect to PostgreSQL database"
    echo "   Please check your JUICEFS_METADATA_URL in .env file"
    echo "   Ensure PostgreSQL is running and database/user exist"
    exit 1
fi
echo "✅ PostgreSQL connection successful"

# Check if filesystem already exists
echo ""
echo "🔍 Checking if filesystem already exists..."
if juicefs status "$JUICEFS_FILESYSTEM_NAME" &> /dev/null; then
    echo "⚠️  Filesystem '$JUICEFS_FILESYSTEM_NAME' already exists"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted. Use existing filesystem."
        exit 0
    fi
    echo "🗑️  Destroying existing filesystem..."
    juicefs destroy "$JUICEFS_FILESYSTEM_NAME" --force
fi

# Create storage directory if using file storage
if [ "$JUICEFS_STORAGE_TYPE" = "file" ]; then
    echo "📁 Creating storage directory: $JUICEFS_BUCKET"
    sudo mkdir -p "$JUICEFS_BUCKET"
    sudo chown -R "$USER:$USER" "$JUICEFS_BUCKET"
fi

# Format the filesystem
echo ""
echo "🔧 Formatting JuiceFS filesystem..."

FORMAT_CMD="juicefs format \
    --storage $JUICEFS_STORAGE_TYPE \
    --bucket $JUICEFS_BUCKET"

# Add storage options if provided
if [ -n "$JUICEFS_ACCESS_KEY" ]; then
    FORMAT_CMD="$FORMAT_CMD --access-key $JUICEFS_ACCESS_KEY"
fi

if [ -n "$JUICEFS_SECRET_KEY" ]; then
    FORMAT_CMD="$FORMAT_CMD --secret-key $JUICEFS_SECRET_KEY"
fi

# Add compression and other options
FORMAT_CMD="$FORMAT_CMD \
    --compress lz4 \
    --block-size 4096 \
    '$JUICEFS_METADATA_URL' \
    '$JUICEFS_FILESYSTEM_NAME'"

echo "Running: $FORMAT_CMD"
echo ""

if eval $FORMAT_CMD; then
    echo ""
    echo "✅ JuiceFS filesystem '$JUICEFS_FILESYSTEM_NAME' formatted successfully!"
    
    # Verify the filesystem
    echo ""
    echo "🔍 Verifying filesystem..."
    if juicefs status "$JUICEFS_FILESYSTEM_NAME" --verbose; then
        echo ""
        echo "🎉 Filesystem verification successful!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Mount the filesystem: ./scripts/mount_juicefs.sh"
        echo "   2. Migrate SVG files: cp -r svg_dataset/* /mnt/juicefs/svg_dataset/"
        echo "   3. Update backend configuration"
    else
        echo "❌ Filesystem verification failed"
        exit 1
    fi
else
    echo "❌ Failed to format JuiceFS filesystem"
    exit 1
fi
