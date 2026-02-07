# Production Deployment Guide

This guide covers deploying the Math2Visual backend in production using Gunicorn WSGI server.

## Overview

The Math2Visual backend is designed to handle concurrent requests efficiently using:
- **Gunicorn WSGI server** for production deployment
- **Unique file naming** with UUIDs to prevent conflicts
- **Parallel file writing** capabilities
- **Automatic cleanup** of temporary files

## Prerequisites

- Python 3.12+
- All dependencies from `requirements.txt`
- OpenAI API key
- Optional: PostgreSQL (for JuiceFS mode)
- Optional: ClamAV (for security scanning)

## Installation

### 1. Install Dependencies

```bash
cd backend/

# Using conda (recommended)
conda create --name math2visual --file requirements.txt
conda activate math2visual

# Or using pip
pip install -r requirements.txt
```

### 2. Configure Environment

Create or update your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Gemini Configuration (SVG generation + tutor)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TUTOR_MODEL=gemini-pro-latest  # optional override

# Storage Configuration
SVG_STORAGE_MODE=local  # or 'juicefs'
SVG_DATASET_PATH=/path/to/svg/dataset
SVG_CACHE_SIZE=100

# Database Configuration (PostgreSQL for tutor sessions and analytics)
# Example:
DATABASE_URL=postgresql://math2visual_user:math2visual_password@localhost:5432/math2visual_analytics
DATABASE_ECHO=false  # Set to true for SQL query logging (development only)

# Tutor Session Configuration
# Inactivity-based expiration for tutor sessions (in hours). Default: 2
TUTOR_SESSION_EXPIRATION_HOURS=2

# CORS Configuration
# Flask environment affects CORS defaults (development=permissive, production=restrictive)
# FLASK_ENV=production
FLASK_ENV=

# Allowed origins for CORS (comma-separated list)
# Examples:
# CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
# CORS_ORIGINS=https://app.example.com
# Leave empty for environment-specific defaults (recommended)
CORS_ORIGINS=

# Frontend URL (used to automatically determine CORS origins in production)
# Example: FRONTEND_URL=https://app.math2visual.com
FRONTEND_URL=
```

## Deployment Options

### Option 1: Using the Production Script (Recommended)

```bash
# Make script executable (if not already)
chmod +x scripts/start_production.sh

# Start the server
./scripts/start_production.sh
```

### Option 2: Direct Gunicorn Command

```bash
# Basic production start
gunicorn --config gunicorn.conf.py wsgi:app

# With logging
gunicorn --config gunicorn.conf.py --access-logfile - --error-logfile - wsgi:app
```

### Option 3: Custom Configuration

```bash
# Custom worker count
gunicorn --workers 8 --bind 0.0.0.0:5000 --timeout 120 wsgi:app

# With specific log files
gunicorn --config gunicorn.conf.py --access-logfile logs/access.log --error-logfile logs/error.log wsgi:app
```

## Configuration

### Gunicorn Configuration (`gunicorn.conf.py`)

The configuration is optimized for Math2Visual:

- **Workers**: Auto-calculated based on CPU cores (min 4)
- **Timeout**: 120 seconds (for ML model loading)
- **Memory**: Preload app for better memory usage
- **Security**: Request limits and proper headers

### Key Settings

```python
# Server
bind = "0.0.0.0:5000"
workers = min(4, multiprocessing.cpu_count() * 2 + 1)
timeout = 120  # For ML model loading
preload_app = True  # Share memory between workers

# Restart workers to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50
```

## Performance Tuning

### Worker Configuration

```bash
# For CPU-intensive tasks (ML models)
workers = CPU_COUNT * 2 + 1

# For I/O-intensive tasks
workers = CPU_COUNT * 4

# Memory-constrained environments
workers = 2-4
```

### Memory Management

- **Preload app**: Shares model memory between workers
- **Worker recycling**: Prevents memory leaks
- **Timeout**: Prevents hanging requests

### File Handling

- **Unique filenames**: UUID-based naming prevents conflicts
- **Parallel writing**: Multiple requests can write simultaneously
- **Cleanup**: Automatic cleanup of temporary files

## Monitoring

### Health Checks

```bash
# Check if server is running
curl http://localhost:5000/api/system/status

# Check worker processes
ps aux | grep gunicorn
```

### Logs

```bash
# Access logs
tail -f logs/access.log

# Error logs
tail -f logs/error.log

# System logs
journalctl -u math2visual-backend -f
```

### Performance Monitoring

```bash
# Check memory usage
ps aux --sort=-%mem | grep gunicorn

# Check CPU usage
top -p $(pgrep -d',' gunicorn)

# Check file descriptors
lsof -p $(pgrep gunicorn) | wc -l
```

## Systemd Service (Optional)

Create `/etc/systemd/system/math2visual-backend.service`:

```ini
[Unit]
Description=Math2Visual Backend
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/path/to/math2visual/backend
Environment=PATH=/path/to/math2visual/backend/venv/bin
ExecStart=/path/to/math2visual/backend/venv/bin/gunicorn --config gunicorn.conf.py wsgi:app
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable math2visual-backend
sudo systemctl start math2visual-backend
sudo systemctl status math2visual-backend
```

## Reverse Proxy (Nginx)

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for ML processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

## Security Considerations

### File Permissions

```bash
# Secure file permissions
chmod 755 /path/to/math2visual/backend
chmod 644 /path/to/math2visual/backend/gunicorn.conf.py
chmod +x /path/to/math2visual/backend/scripts/start_production.sh
```

### Environment Variables

- Never commit API keys to version control
- Use environment variables for sensitive data
- Consider using a secrets management system

### Network Security

- Use HTTPS in production
- Configure firewall rules
- Consider rate limiting for API endpoints

## Troubleshooting

### Common Issues

1. **Out of Memory**
   ```bash
   # Reduce workers
   gunicorn --workers 2 --config gunicorn.conf.py wsgi:app
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout
   gunicorn --timeout 180 --config gunicorn.conf.py wsgi:app
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :5000
   # Kill the process or use different port
   gunicorn --bind 0.0.0.0:5001 --config gunicorn.conf.py wsgi:app
   ```

### Debug Mode

```bash
# Run in debug mode
FLASK_DEBUG=true gunicorn --config gunicorn.conf.py wsgi:app
```

### Log Analysis

```bash
# Check for errors
grep -i error logs/error.log

# Check response times
grep "GET /api/generate" logs/access.log | awk '{print $NF}' | sort -n
```

## Scaling

### Horizontal Scaling

- Use a load balancer (Nginx, HAProxy)
- Deploy multiple instances on different ports
- Use a reverse proxy to distribute requests

### Vertical Scaling

- Increase worker count
- Add more memory
- Use faster storage (SSD)

## Backup and Recovery

### File Backups

```bash
# Backup generated files
tar -czf math2visual-backup-$(date +%Y%m%d).tar.gz storage/output/

# Backup configuration
cp gunicorn.conf.py config-backup/
```

### Database Backups (JuiceFS)

```bash
# PostgreSQL backup
pg_dump juicefs_metadata > juicefs-backup-$(date +%Y%m%d).sql
```

## Maintenance

### Regular Tasks

1. **Cleanup temporary files**
   ```bash
   python scripts/cleanup_temp_files.py
   ```

2. **Monitor disk space**
   ```bash
   df -h
   du -sh storage/output/
   ```

3. **Update dependencies**
   ```bash
   pip install --upgrade -r requirements.txt
   ```

### Health Monitoring

- Set up monitoring for response times
- Monitor memory usage
- Track error rates
- Set up alerts for critical issues

## Performance Benchmarks

### Expected Performance

- **Concurrent requests**: 10-50 requests/second
- **Response time**: 2-10 seconds (depending on complexity)
- **Memory usage**: 1-4GB per worker
- **File generation**: 2 files per request (formal + intuitive)

### Optimization Tips

1. **Use SSD storage** for better I/O performance
2. **Increase worker count** for higher concurrency
3. **Monitor memory usage** and adjust worker recycling
4. **Use connection pooling** for database operations
5. **Implement caching** for frequently requested visualizations
