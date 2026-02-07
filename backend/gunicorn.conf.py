# Gunicorn configuration for Math2Visual backend
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
# Using gevent async workers for streaming support (Server-Sent Events in tutor/chat endpoints)
# Must use async workers when proxy_buffering is disabled in nginx
workers = min(4, multiprocessing.cpu_count() * 2 + 1)
worker_class = "gevent"
worker_connections = 1000
timeout = 120  # Increased for ML model loading
keepalive = 2

# Restart workers after this many requests, to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Preload application for better memory usage
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "math2visual-backend"

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Note: SSL/TLS is handled by Nginx reverse proxy
# Gunicorn runs on HTTP (localhost:5000) and Nginx handles HTTPS termination

# Worker lifecycle
def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Math2Visual backend server is ready. Workers: %s", server.cfg.workers)

def worker_int(worker):
    """Called just after a worker has been forked."""
    worker.log.info("Worker spawned (pid: %s)", worker.pid)

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info("Worker will be spawned")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal."""
    worker.log.info("Worker received SIGABRT signal")
