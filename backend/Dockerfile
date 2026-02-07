# Use Python 3.12 slim as base image
FROM python:3.12-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    libxml2-dev \
    libxslt1-dev \
    pkg-config \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app /app/storage /app/logs && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Switch to app user
USER appuser

# Copy requirements first for better layer caching
COPY --chown=appuser:appuser requirements.txt .

# Install Python dependencies
RUN pip install --user --no-cache-dir -r requirements.txt && \
    pip install --user gunicorn

# Add user's local bin to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code
COPY --chown=appuser:appuser . .

# Expose port
EXPOSE 5000

# Health check (checks if the server port is listening)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import socket; s = socket.socket(); s.settimeout(2); result = s.connect_ex(('127.0.0.1', 5000)); s.close(); exit(0 if result == 0 else 1)"

# Default command (can be overridden)
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]

