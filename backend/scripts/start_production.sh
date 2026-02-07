#!/bin/bash
# Production startup script for Math2Visual backend with Gunicorn

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "$BACKEND_DIR/wsgi.py" ]; then
    error "wsgi.py not found. Please run this script from the backend directory or ensure the project structure is correct."
    exit 1
fi

log "Starting Math2Visual backend in production mode..."

# Change to backend directory
cd "$BACKEND_DIR"

# Check for virtual environment
if [ -d "venv" ]; then
    log "Activating virtual environment..."
    source venv/bin/activate
elif [ -d "../venv" ]; then
    log "Activating virtual environment from parent directory..."
    source ../venv/bin/activate
elif command -v conda &> /dev/null && conda info --envs | grep -q math2visual; then
    log "Activating conda environment..."
    source $(conda info --base)/etc/profile.d/conda.sh
    conda activate math2visual
else
    warning "No virtual environment found. Make sure dependencies are installed globally."
fi

# Check if Gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    error "Gunicorn is not installed. Please install it with: pip install gunicorn"
    exit 1
fi

# Check if configuration file exists
if [ ! -f "gunicorn.conf.py" ]; then
    error "Gunicorn configuration file not found. Please ensure gunicorn.conf.py exists."
    exit 1
fi

# Check environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    warning "OPENAI_API_KEY environment variable is not set."
fi

# Create necessary directories
log "Creating necessary directories..."
mkdir -p storage/output
mkdir -p logs

# Set environment variables
export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"

# Display configuration
log "Configuration:"
log "  - Backend directory: $BACKEND_DIR"
log "  - Workers: $(python -c "import multiprocessing; print(min(4, multiprocessing.cpu_count() * 2 + 1))")"
log "  - Bind address: 0.0.0.0:5000"
log "  - Timeout: 120 seconds"

# Start the server
log "Starting Gunicorn server..."
success "Math2Visual backend is starting with Gunicorn..."

exec gunicorn \
    --config gunicorn.conf.py \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    wsgi:app
