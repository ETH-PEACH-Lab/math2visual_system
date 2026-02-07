#!/bin/bash

# JuiceFS Installation Script for Math2Visual
# This script installs JuiceFS on Linux systems

set -e

echo "🚀 Installing JuiceFS for Math2Visual..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please do not run this script as root"
    exit 1
fi

# Check system architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64)
        ARCH="arm64"
        ;;
    armv7l)
        ARCH="arm"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
elif command -v lsb_release &> /dev/null; then
    OS=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
elif [ -f /etc/debian_version ]; then
    OS="debian"
elif [ "$(uname)" = "Darwin" ]; then
    OS="macos"
else
    echo "❌ Cannot detect OS"
    exit 1
fi

echo "📋 Detected system: $OS $ARCH"

# Install dependencies
echo "📦 Installing dependencies..."
case $OS in
    ubuntu|debian)
        sudo apt update
        sudo apt install -y curl wget fuse3 python3-pip
        ;;
    centos|rhel|fedora)
        if command -v dnf &> /dev/null; then
            sudo dnf install -y curl wget fuse3 python3-pip
        else
            sudo yum install -y curl wget fuse python3-pip
        fi
        ;;
    macos)
        if command -v brew &> /dev/null; then
            brew install curl wget macfuse
        else
            echo "⚠️  Please install Homebrew first: https://brew.sh/"
            echo "⚠️  Then install: brew install curl wget macfuse"
        fi
        ;;
    *)
        echo "⚠️  Please install curl, wget, fuse3, and python3-pip manually for OS: $OS"
        ;;
esac

# Download and install JuiceFS
JUICEFS_VERSION=$(curl -s https://api.github.com/repos/juicedata/juicefs/releases/latest | grep '"tag_name":' | cut -d'"' -f4)
echo "📥 Downloading JuiceFS $JUICEFS_VERSION..."

DOWNLOAD_URL="https://github.com/juicedata/juicefs/releases/download/${JUICEFS_VERSION}/juicefs-${JUICEFS_VERSION}-linux-${ARCH}.tar.gz"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Download and extract
curl -L "$DOWNLOAD_URL" -o juicefs.tar.gz
tar -xzf juicefs.tar.gz

# Install JuiceFS binary
sudo cp juicefs /usr/local/bin/
sudo chmod +x /usr/local/bin/juicefs

# Cleanup
cd ~
rm -rf "$TEMP_DIR"

# Verify installation
echo "✅ Verifying JuiceFS installation..."
if command -v juicefs &> /dev/null; then
    INSTALLED_VERSION=$(juicefs version 2>/dev/null | head -1 | awk '{print $3}')
    echo "✅ JuiceFS $INSTALLED_VERSION installed successfully!"
else
    echo "❌ JuiceFS installation failed"
    exit 1
fi

# Create required directories
echo "📁 Creating required directories..."
sudo mkdir -p /mnt/juicefs
sudo mkdir -p /var/log/juicefs
sudo mkdir -p /var/cache/juicefs

# Set permissions
sudo chown -R "$USER:$USER" /mnt/juicefs
sudo chown -R "$USER:$USER" /var/cache/juicefs

echo ""
echo "🎉 JuiceFS installation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Complete PostgreSQL setup (database and user creation)"
echo "   2. Run the format script: ./scripts/format_juicefs.sh"
echo "   3. Mount the filesystem: ./scripts/mount_juicefs.sh"
echo ""
echo "📍 Mount point created: /mnt/juicefs"
echo "📍 Cache directory: /var/cache/juicefs"
echo "📍 Log directory: /var/log/juicefs"
