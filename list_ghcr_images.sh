#!/bin/bash
# Script to list all container images from GitHub Container Registry
#
# This script can list:
#   1. All packages in an organization
#   2. All versions of a specific package
#
# Prerequisites:
#   - GitHub CLI (gh) must be installed: https://cli.github.com/
#   - You must be authenticated: gh auth login
#   - You must have permissions to read packages
#
# Usage:
#   ./list_ghcr_images.sh                           # List all packages in organization
#   ./list_ghcr_images.sh [OWNER] [TYPE]            # List all packages for owner
#   ./list_ghcr_images.sh [OWNER] [TYPE] [PACKAGE]  # List versions of specific package

set -e

# Default configuration
DEFAULT_OWNER="eth-peach-lab"
DEFAULT_TYPE="orgs"  # Use "orgs" for organizations, "users" for personal accounts

# Parse arguments
OWNER="${1:-$DEFAULT_OWNER}"
TYPE="${2:-$DEFAULT_TYPE}"
PACKAGE_NAME="${3:-}"

echo "=========================================="
echo "GitHub Container Registry Images"
echo "=========================================="
echo "Owner: $OWNER"
echo "Type: $TYPE"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo ""
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo ""
    echo "Error: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

if [ -z "$PACKAGE_NAME" ]; then
    # List all packages in the organization
    echo ""
    echo "Fetching all container packages..."
    echo ""
    
    packages=$(gh api \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/$TYPE/$OWNER/packages?package_type=container" \
        --jq '.[] | {name: .name, visibility: .visibility, created_at: .created_at, updated_at: .updated_at, url: .html_url}' 2>&1)
    
    if echo "$packages" | grep -q "Could not resolve"; then
        echo "Error: Could not fetch packages. Check owner name and permissions."
        exit 1
    fi
    
    if [ -z "$packages" ]; then
        echo "No container packages found for: $OWNER"
        exit 0
    fi
    
    echo "Container packages in $OWNER:"
    echo ""
    echo "$packages" | jq -s 'sort_by(.updated_at) | reverse | .[]'
    echo ""
    
    # Count packages
    package_count=$(echo "$packages" | jq -s '. | length')
    echo "Total packages: $package_count"
    echo ""
    
    # List packages related to math2visual_system
    echo "Packages containing 'math2visual':"
    echo "$packages" | jq -s '.[] | select(.name | contains("math2visual"))' | jq -s '.'
    echo ""
    
    echo "To see versions of a specific package, run:"
    echo "  ./list_ghcr_images.sh $OWNER $TYPE <package-name>"
    echo ""
    echo "Example:"
    echo "  ./list_ghcr_images.sh $OWNER $TYPE \"math2visual_system/math2visual\""
    
else
    # List all versions of a specific package
    # URL encode the package name
    ENCODED_PACKAGE_NAME="${PACKAGE_NAME//\//%2F}"
    
    echo "Package: $PACKAGE_NAME"
    echo ""
    echo "Fetching package versions..."
    echo ""
    
    versions=$(gh api \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/$TYPE/$OWNER/packages/container/$ENCODED_PACKAGE_NAME/versions" \
        --jq '.[] | {id: .id, name: .name, created_at: .created_at, updated_at: .updated_at, tags: (.metadata.container.tags // []), size_bytes: (.metadata.container | if .size_bytes then .size_bytes else null end)}' 2>&1)
    
    if echo "$versions" | grep -q "Could not resolve to a Package"; then
        echo "Error: Package not found: $PACKAGE_NAME"
        echo ""
        echo "Available packages:"
        gh api \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "/$TYPE/$OWNER/packages?package_type=container" \
            --jq '.[].name'
        exit 1
    fi
    
    if [ -z "$versions" ]; then
        echo "No versions found for package: $PACKAGE_NAME"
        exit 0
    fi
    
    echo "Versions of ghcr.io/$OWNER/$PACKAGE_NAME:"
    echo ""
    echo "$versions" | jq -s 'sort_by(.created_at) | reverse | .[]'
    echo ""
    
    # Count versions
    version_count=$(echo "$versions" | jq -s '. | length')
    tagged_count=$(echo "$versions" | jq -s '[.[] | select(.tags | length > 0)] | length')
    untagged_count=$((version_count - tagged_count))
    
    echo "Summary:"
    echo "  Total versions: $version_count"
    echo "  Tagged versions: $tagged_count"
    echo "  Untagged versions: $untagged_count"
    echo ""
    
    # Show tagged versions in a nice format
    if [ "$tagged_count" -gt 0 ]; then
        echo "Tagged versions:"
        echo "$versions" | jq -s '[.[] | select(.tags | length > 0) | {tags: .tags, created: .created_at, digest: .name}] | .[]'
    fi
fi
