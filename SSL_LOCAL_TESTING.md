# Local SSL Testing Guide

This guide explains how to test SSL/TLS setup on your local machine without needing a real domain or Let's Encrypt certificates.

## Option 1: Using mkcert (Recommended for Local Testing)

`mkcert` creates locally-trusted certificates that your browser will accept without warnings.

### Step 1: Install mkcert

**On Linux:**
```bash
# Install certutil
sudo apt install libnss3-tools

# Download mkcert
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

**On macOS:**
```bash
brew install mkcert
```

**On Windows:**
```bash
choco install mkcert
```

### Step 2: Install Local CA

```bash
mkcert -install
```

### Step 3: Generate Certificates for Local Testing

```bash
# Create certificate directory structure
mkdir -p certbot/conf/live/localhost

# Generate certificate for localhost
mkcert -key-file certbot/conf/live/localhost/privkey.pem \
       -cert-file certbot/conf/live/localhost/fullchain.pem \
       localhost 127.0.0.1 ::1

# Note: mkcert creates a single file, but nginx expects fullchain.pem
# The mkcert cert file already contains the full chain
```

### Step 4: Update nginx.conf for Local Testing

Update the SSL certificate paths in `nginx.conf`:

```nginx
ssl_certificate /etc/letsencrypt/live/localhost/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/localhost/privkey.pem;
```

### Step 5: Start the Container

```bash
docker-compose up -d app
```

### Step 6: Test

Visit `https://localhost` in your browser. It should work without certificate warnings.

---

## Option 2: Self-Signed Certificates

If you don't want to install mkcert, you can use self-signed certificates (browsers will show warnings).

### Step 1: Generate Self-Signed Certificate

```bash
# Create certificate directory structure
mkdir -p certbot/conf/live/localhost

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certbot/conf/live/localhost/privkey.pem \
    -out certbot/conf/live/localhost/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Step 2: Update nginx.conf

Same as Option 1, Step 4.

### Step 3: Start and Test

```bash
docker-compose up -d app
```

Visit `https://localhost` - you'll need to accept the security warning in your browser.

---

## Option 3: HTTP-Only Testing (No SSL)

For basic functionality testing without SSL:

### Step 1: Create a Temporary nginx.conf

Create `nginx.conf.http` with HTTP-only configuration:

```nginx
server {
    listen 80;
    server_name _;
    
    server_tokens off;
    
    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Flask backend
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }
}
```

### Step 2: Use HTTP Config

```bash
# Backup original
cp nginx.conf nginx.conf.ssl

# Use HTTP version
cp nginx.conf.http nginx.conf

# Rebuild and start
docker-compose up -d --build app
```

### Step 3: Test

Visit `http://localhost` (note: HTTP, not HTTPS).

---

## Option 4: Test with Let's Encrypt Staging (Real Domain Required)

If you have a real domain and want to test the Let's Encrypt flow without hitting rate limits:

### Step 1: Use Staging Environment

Modify the certbot command in `SSL_SETUP.md` Step 4 to use staging:

```bash
docker-compose run --rm certbot-init \
  certbot certonly --webroot \
  --staging \
  -w /var/www/certbot \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

The `--staging` flag uses Let's Encrypt's staging environment which has higher rate limits.

---

## Quick Test Script

Create a script to quickly switch between SSL and HTTP testing:

```bash
#!/bin/bash
# save as test-ssl.sh

case "$1" in
  ssl)
    echo "Setting up SSL with mkcert..."
    mkdir -p certbot/conf/live/localhost
    mkcert -key-file certbot/conf/live/localhost/privkey.pem \
           -cert-file certbot/conf/live/localhost/fullchain.pem \
           localhost 127.0.0.1 ::1
    # Update nginx.conf to use localhost certificates
    sed -i 's|/etc/letsencrypt/live/.*/fullchain.pem|/etc/letsencrypt/live/localhost/fullchain.pem|' nginx.conf
    sed -i 's|/etc/letsencrypt/live/.*/privkey.pem|/etc/letsencrypt/live/localhost/privkey.pem|' nginx.conf
    echo "SSL setup complete. Start with: docker-compose up -d app"
    ;;
  http)
    echo "Setting up HTTP-only..."
    # Create minimal HTTP config
    cat > nginx.conf.http <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
    cp nginx.conf.http nginx.conf
    echo "HTTP setup complete. Start with: docker-compose up -d --build app"
    ;;
  *)
    echo "Usage: $0 {ssl|http}"
    exit 1
    ;;
esac
```

Make it executable:
```bash
chmod +x test-ssl.sh
```

---

## Verification Steps

### Test HTTPS Connection

```bash
# Test with curl (ignore certificate warnings for self-signed)
curl -k https://localhost

# Test with openssl
openssl s_client -connect localhost:443 -servername localhost
```

### Check Certificate Details

```bash
# View certificate info
openssl x509 -in certbot/conf/live/localhost/fullchain.pem -text -noout
```

### Test Nginx Configuration

```bash
# Test nginx config inside container
docker-compose exec app nginx -t
```

### Check Container Logs

```bash
# View nginx logs
docker-compose logs app

# Follow logs
docker-compose logs -f app
```

---

## Troubleshooting

### Certificate Not Found Error

- Verify certificate files exist: `ls -la certbot/conf/live/localhost/`
- Check nginx.conf paths match the certificate location
- Ensure certificates are readable: `chmod 644 certbot/conf/live/localhost/*.pem`

### Port Already in Use

```bash
# Check what's using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2  # if using Apache
sudo systemctl stop nginx     # if using system nginx
```

### Browser Shows "Not Secure"

- For mkcert: Ensure you ran `mkcert -install`
- For self-signed: This is expected - click "Advanced" → "Proceed to localhost"
- Clear browser cache and try again

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Test nginx config
docker-compose exec app nginx -t

# Rebuild container
docker-compose up -d --build app
```

### Seeing "Welcome to nginx!" Instead of the App

If you access `http://<EC2_IP>` or `http://localhost` and only see the generic **"Welcome to nginx!"** page:

```bash
# Open a shell in the running container
docker exec -it math2visual /bin/bash

# Comment out the sites-enabled include
sed -i 's@include /etc/nginx/sites-enabled/\*;@# include /etc/nginx/sites-enabled/*;@' /etc/nginx/nginx.conf

# Verify the change (you should see the line commented out)
grep 'sites-enabled' -n /etc/nginx/nginx.conf

# Test and reload nginx
nginx -t && nginx -s reload
```

Then, from the host:

```bash
curl -k https://localhost | head
```

You should now see the Math2Visual/Vite HTML instead of the Nginx welcome page.

---

## Recommended Approach

For local development and testing:
1. **Use mkcert (Option 1)** - Best experience, no browser warnings
2. **Use HTTP-only (Option 3)** - Simplest for quick testing
3. **Use self-signed (Option 2)** - If mkcert isn't available

For production-like testing:
- Use **Option 4** with Let's Encrypt staging and a real domain

