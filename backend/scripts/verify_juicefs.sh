#!/bin/bash

# JuiceFS Verification Script for Math2Visual
# This script verifies the JuiceFS installation and setup

set -e

echo "🔍 Verifying JuiceFS Setup for Math2Visual..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if JuiceFS is installed
echo "1. Checking JuiceFS installation..."
if command -v juicefs &> /dev/null; then
    VERSION=$(juicefs version 2>/dev/null | head -1 | awk '{print $3}')
    print_status 0 "JuiceFS $VERSION is installed"
else
    print_status 1 "JuiceFS is not installed"
    echo "   Please run: ./scripts/install_juicefs.sh"
    exit 1
fi

# Check required directories
echo ""
echo "2. Checking required directories..."

check_directory() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        if [ -w "$dir" ]; then
            print_status 0 "$description exists and is writable"
        else
            print_status 1 "$description exists but is not writable"
        fi
    else
        print_status 1 "$description does not exist"
    fi
}

check_directory "/mnt/juicefs" "Mount point (/mnt/juicefs)"
check_directory "/var/cache/juicefs" "Cache directory (/var/cache/juicefs)"
check_directory "/var/log/juicefs" "Log directory (/var/log/juicefs)"

# Check FUSE support
echo ""
echo "3. Checking FUSE support..."
if [ -c /dev/fuse ]; then
    print_status 0 "FUSE device is available"
else
    print_status 1 "FUSE device is not available"
    echo "   Please install fuse3: sudo apt install fuse3"
fi

# Check if user can access FUSE
if groups $USER | grep -q fuse; then
    print_status 0 "User is in fuse group"
else
    print_warning "User is not in fuse group (may be optional on newer systems)"
fi

# Check PostgreSQL connection (if .env exists)
echo ""
echo "4. Checking PostgreSQL connection..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    
    if [ -n "$JUICEFS_METADATA_URL" ]; then
        # Extract connection details from URL
        if command -v psql &> /dev/null; then
            if psql "$JUICEFS_METADATA_URL" -c "SELECT version();" &> /dev/null; then
                print_status 0 "PostgreSQL connection successful"
            else
                print_status 1 "PostgreSQL connection failed"
                echo "   Please check your database configuration"
            fi
        else
            print_warning "psql not found, cannot test PostgreSQL connection"
        fi
    else
        print_warning "JUICEFS_METADATA_URL not set in .env file"
    fi
else
    print_warning ".env file not found, cannot test PostgreSQL connection"
fi

# Check if JuiceFS filesystem is already formatted
echo ""
echo "5. Checking JuiceFS filesystem status..."

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    
    # Set defaults if not provided
    JUICEFS_FILESYSTEM_NAME=${JUICEFS_FILESYSTEM_NAME:-"math2visual-fs"}
    
    if [ -n "$JUICEFS_METADATA_URL" ]; then
        if juicefs status "$JUICEFS_FILESYSTEM_NAME" --verbose &> /dev/null; then
            print_status 0 "JuiceFS filesystem '$JUICEFS_FILESYSTEM_NAME' is formatted"
            
            # Check if mounted
            if mountpoint -q "/mnt/juicefs" 2>/dev/null; then
                print_status 0 "JuiceFS is mounted at /mnt/juicefs"
                
                # Check mount health
                if [ -w "/mnt/juicefs" ]; then
                    print_status 0 "Mount point is healthy and writable"
                else
                    print_status 1 "Mount point is not writable"
                fi
            else
                print_warning "JuiceFS filesystem is formatted but not mounted"
                echo "   Run: ./scripts/mount_juicefs.sh"
            fi
        else
            print_warning "JuiceFS filesystem 'math2visual-fs' is not formatted"
            echo "   Run: ./scripts/format_juicefs.sh"
        fi
    fi
fi

# Summary
echo ""
echo "📋 System Requirements Summary:"
echo "   - JuiceFS: $(command -v juicefs &> /dev/null && echo 'Installed' || echo 'Missing')"
echo "   - FUSE: $([ -c /dev/fuse ] && echo 'Available' || echo 'Missing')"
echo "   - PostgreSQL: $(command -v psql &> /dev/null && echo 'Available' || echo 'Missing')"
echo "   - Mount Point: $([ -d /mnt/juicefs ] && echo 'Ready' || echo 'Missing')"

echo ""
if mountpoint -q "/mnt/juicefs" 2>/dev/null; then
    echo "🎉 JuiceFS is ready to use!"
else
    echo "⏳ Complete the setup by running format and mount scripts"
fi
