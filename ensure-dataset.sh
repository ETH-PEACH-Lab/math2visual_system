#!/bin/bash
# Script to ensure SVG dataset exists, downloading from GitHub if needed

DATASET_DIR="/app/storage/datasets/svg_dataset"
GITHUB_REPO="https://github.com/7i6ht/math2visual.git"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
MIN_SVG_FILES=100  # Minimum number of SVG files to consider dataset valid

echo "Checking SVG dataset..."

# Check if dataset directory exists and has sufficient files
if [ -d "$DATASET_DIR" ]; then
    svg_count=$(find "$DATASET_DIR" -name "*.svg" 2>/dev/null | wc -l || echo "0")
    echo "  Found $svg_count SVG files in dataset"
    
    if [ "$svg_count" -ge "$MIN_SVG_FILES" ]; then
        echo "✓ Dataset is present and valid ($svg_count files)"
        exit 0
    else
        echo "⚠️  Dataset directory exists but has insufficient files ($svg_count < $MIN_SVG_FILES)"
        echo "  Will download dataset from GitHub..."
    fi
else
    echo "⚠️  Dataset directory does not exist"
    echo "  Will download dataset from GitHub..."
    mkdir -p "$DATASET_DIR"
fi

# Download dataset from GitHub
echo "Downloading dataset from GitHub..."
echo "  Repository: $GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo "  Target: $DATASET_DIR"

# Create temporary directory for cloning
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ ERROR: git is not available. Cannot download dataset."
    echo "   Please ensure git is installed or provide the dataset manually."
    exit 1
fi

# Clone repository (shallow, only the needed branch)
echo "  Cloning repository (this may take a moment)..."
if git clone --depth 1 --branch "$GITHUB_BRANCH" --single-branch "$GITHUB_REPO" "$TEMP_DIR/repo" 2>&1; then
    # Copy dataset directory
    if [ -d "$TEMP_DIR/repo/backend/storage/datasets/svg_dataset" ]; then
        echo "  Copying dataset files..."
        # Use rsync if available, otherwise cp
        if command -v rsync &> /dev/null; then
            rsync -a "$TEMP_DIR/repo/backend/storage/datasets/svg_dataset/" "$DATASET_DIR/"
        else
            cp -r "$TEMP_DIR/repo/backend/storage/datasets/svg_dataset/"* "$DATASET_DIR/" 2>/dev/null || true
        fi
        
        # Verify files were copied
        svg_count=$(find "$DATASET_DIR" -name "*.svg" 2>/dev/null | wc -l || echo "0")
        if [ "$svg_count" -ge "$MIN_SVG_FILES" ]; then
            echo "✓ Dataset downloaded successfully ($svg_count files)"
            # Set permissions
            chmod -R 755 "$DATASET_DIR" 2>/dev/null || true
            exit 0
        else
            echo "❌ ERROR: Downloaded dataset has insufficient files ($svg_count < $MIN_SVG_FILES)"
            exit 1
        fi
    else
        echo "❌ ERROR: Dataset directory not found in repository"
        exit 1
    fi
else
    echo "❌ ERROR: Failed to clone repository"
    echo "   This might be due to network issues or repository access problems."
    exit 1
fi

