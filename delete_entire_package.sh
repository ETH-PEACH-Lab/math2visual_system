#!/bin/bash
# Script to delete the ENTIRE math2visual package from GitHub Container Registry
#
# WARNING: This will delete ALL versions and tags of the package!
#
# Prerequisites:
#   - GitHub CLI (gh) must be installed: https://cli.github.com/
#   - You must be authenticated: gh auth login
#   - You must have permissions to delete packages in the organization
#
# Usage:
#   ./delete_entire_package.sh [OWNER] [PACKAGE_NAME] [TYPE]

set -e

# Default configuration
DEFAULT_OWNER="eth-peach-lab"
DEFAULT_PACKAGE_NAME="math2visual_system%2Fmath2visual"
DEFAULT_TYPE="orgs"

# Use command-line arguments or defaults
OWNER="${1:-$DEFAULT_OWNER}"
PACKAGE_NAME="${2:-$DEFAULT_PACKAGE_NAME}"
TYPE="${3:-$DEFAULT_TYPE}"

# Decode package name for display
DISPLAY_PACKAGE_NAME="${PACKAGE_NAME//%2F//}"

echo "=========================================="
echo "⚠️  DELETE ENTIRE PACKAGE FROM GHCR ⚠️"
echo "=========================================="
echo "Owner: $OWNER"
echo "Package: $DISPLAY_PACKAGE_NAME"
echo "Type: $TYPE"
echo ""
echo "⚠️  WARNING: This will delete ALL versions and tags!"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "Fetching package information..."
echo ""

# Get all versions of the package
versions=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/$TYPE/$OWNER/packages/container/$PACKAGE_NAME/versions" \
    --jq '.[] | {id: .id, name: .name, created_at: .created_at, tags: (.metadata.container.tags // [])}' 2>&1)

if echo "$versions" | grep -q "Could not resolve to a Package"; then
    echo "Package not found: $DISPLAY_PACKAGE_NAME"
    exit 0
fi

if [ -z "$versions" ]; then
    echo "No versions found for package: $DISPLAY_PACKAGE_NAME"
    exit 0
fi

echo "Current package versions:"
echo "$versions" | jq -s '.'
echo ""

# Count versions
version_count=$(echo "$versions" | jq -s '. | length')
echo "Total versions: $version_count"
echo ""

# Final confirmation with package name verification
echo "⚠️  FINAL WARNING ⚠️"
echo "You are about to delete the ENTIRE package:"
echo "  ghcr.io/$OWNER/$DISPLAY_PACKAGE_NAME"
echo ""
echo "This will remove:"
echo "  - All $version_count version(s)"
echo "  - All tags (including 'latest', '1.1', etc.)"
echo "  - The package itself"
echo ""
read -p "Type the package name '$DISPLAY_PACKAGE_NAME' to confirm: " user_input

if [ "$user_input" != "$DISPLAY_PACKAGE_NAME" ]; then
    echo "Package name doesn't match. Deletion cancelled."
    exit 1
fi

read -p "Are you absolutely sure? Type 'DELETE' to proceed: " final_confirm

if [ "$final_confirm" != "DELETE" ]; then
    echo "Deletion cancelled."
    exit 0
fi

echo ""
echo "Deleting package..."

# Delete the entire package
gh api \
    --method DELETE \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/$TYPE/$OWNER/packages/container/$PACKAGE_NAME"

echo ""
echo "✓ Successfully deleted package: $DISPLAY_PACKAGE_NAME"
echo ""
echo "The package ghcr.io/$OWNER/$DISPLAY_PACKAGE_NAME has been completely removed."
