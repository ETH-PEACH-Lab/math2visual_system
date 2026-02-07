# Multi-stage Dockerfile for Math2Visual Application
# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build frontend for production
ARG VITE_ENABLE_ANALYTICS=false
ENV VITE_ENABLE_ANALYTICS=${VITE_ENABLE_ANALYTICS}

# Build for production
RUN npm run build

# Stage 2: Backend with Nginx
FROM python:3.12-slim AS backend

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies including Nginx and cron (for cleanup service)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    libxml2-dev \
    libxslt1-dev \
    pkg-config \
    cmake \
    nginx \
    cron \
    procps \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app /app/storage/output /app/storage/temp_svgs && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY --chown=appuser:appuser backend/requirements.txt .

# Install Python dependencies as appuser
# Switch to appuser to install packages in the correct location
USER appuser
RUN pip install --user --no-cache-dir -r requirements.txt && \
    pip install --user gunicorn

# Add user's local bin to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Switch back to root for remaining operations (file copies, nginx setup)
USER root

# Copy backend application code
COPY --chown=appuser:appuser backend/ .

# Note: SVG dataset is NOT copied into the image
# It will be downloaded from GitHub on first run if not present in the volume mount

# Ensure storage directories have correct permissions for appuser
RUN chown -R appuser:appuser /app/storage && \
    chmod -R 755 /app/storage

# Copy built frontend to Nginx html directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script and dataset download script
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY ensure-dataset.sh /ensure-dataset.sh
RUN chmod +x /docker-entrypoint.sh /ensure-dataset.sh

# Expose ports 80 (HTTP) and 443 (HTTPS)
EXPOSE 80 443

# Health check (checks if Nginx is responding)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python3 -c "import socket; s = socket.socket(); s.settimeout(2); result = s.connect_ex(('127.0.0.1', 80)); s.close(); exit(0 if result == 0 else 1)"

# Default command (starts both Gunicorn and Nginx)
CMD ["/docker-entrypoint.sh"]

