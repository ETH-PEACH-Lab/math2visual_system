# Frontend Production Deployment Guide

This guide covers deploying the Math2Visual frontend in production as a static React application.

## Overview

The Math2Visual frontend is a React application built with Vite that produces static files for production deployment. The production build can be served using:

- **Static file servers** (serve, http-server)
- **Web servers** (Nginx, Apache)
- **CDN/Cloud hosting** (Vercel, Netlify, AWS S3 + CloudFront)

## Prerequisites

- Node.js 18+
- npm or yarn
- Math2Visual backend running and accessible
- Web server (Nginx recommended) or static file server

## Pre-Build Security Configuration

### Vite Proxy Security

**Important**: Before building for production, ensure the development proxy security setting is removed from `vite.config.ts`:

```typescript
// frontend/vite.config.ts - REMOVE THIS LINE BEFORE PRODUCTION BUILD
secure: false, // TODO: remove this when the backend is deployed
```

The `secure: false` setting in Vite's proxy configuration disables SSL certificate validation, which is useful during development but poses a security risk in production. This setting should only be present during local development and must be removed when building for production deployments with proper SSL certificates.

## Production Build

### 1. Build the Application

```bash
cd frontend/

# Install dependencies (if not already done)
npm install

# Set production backend URL (optional, if different from default)
export VITE_BACKEND_URL=https://your-backend-url.com

# Build for production
npm run build
```

The build process will:
- Compile TypeScript to JavaScript
- Optimize and minify code
- Bundle assets
- Generate production-ready files in the `dist/` directory

### 2. Verify the Build

```bash
# Preview the production build locally
npm run preview
```

This starts Vite's preview server on `http://localhost:4173` (default port) to test the production build before deployment.

## Deployment Options

### Option 1: Using a Static File Server (Simple)

#### Using `serve` (Recommended for quick deployments)

```bash
# Install serve globally
npm install -g serve

# Serve the production build
serve -s dist -l 3000

# With custom port
serve -s dist -l 8080

# With HTTPS (requires certificates)
serve -s dist -l 3000 --ssl-cert cert.pem --ssl-key key.pem
```

#### Using `http-server`

```bash
# Install http-server globally
npm install -g http-server

# Serve the production build
http-server dist -p 3000

# With CORS enabled (if needed)
http-server dist -p 3000 --cors

# With HTTPS
http-server dist -p 3000 -S -C cert.pem -K key.pem
```

#### Using `npx` (No installation required)

```bash
# Using serve
npx serve -s dist -l 3000

# Using http-server
npx http-server dist -p 3000
```

### Option 2: Using Nginx (Recommended for Production)

#### Basic Nginx Configuration

Create or update `/etc/nginx/sites-available/math2visual-frontend`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/math2visual/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for ML processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

#### Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/math2visual-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### HTTPS Configuration (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

### Option 3: Using Apache

#### Basic Apache Configuration

Create or update `/etc/apache2/sites-available/math2visual-frontend.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/math2visual/frontend/dist

    <Directory /path/to/math2visual/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable URL rewriting for React Router
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy API requests to backend
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:5000/api
    ProxyPassReverse /api http://127.0.0.1:5000/api
</VirtualHost>
```

#### Enable the Site

```bash
# Enable the site
sudo a2ensite math2visual-frontend.conf

# Enable required modules
sudo a2enmod rewrite proxy proxy_http

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

### Option 4: Cloud Hosting

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend/
vercel

# Or connect your GitHub repository to Vercel dashboard
```

Create `vercel.json` in the frontend directory:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Netlify

Create `netlify.toml` in the frontend directory:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Deploy via Netlify CLI or connect your Git repository.

## Configuration

### Environment Variables

The frontend uses environment variables that must be set **before building**:

```bash
# Backend URL for production (required if different from default)
VITE_BACKEND_URL=https://api.your-domain.com

# Build with environment variable
VITE_BACKEND_URL=https://api.your-domain.com npm run build
```

**Important**: Environment variables prefixed with `VITE_` are embedded at build time. Changes require a rebuild.

### Backend URL Configuration

The frontend needs to know where the backend API is located. There are two ways to configure this:

1. **Build-time configuration** (recommended):
   ```bash
   VITE_BACKEND_URL=https://api.your-domain.com npm run build
   ```

2. **Runtime configuration** (requires code changes):
   Update `src/config/api.ts` to read from a configuration file or environment-specific settings.

### API Endpoints

The frontend expects the backend to be accessible at:
- Development: `http://localhost:5000` (via Vite proxy)
- Production: Configured via `VITE_BACKEND_URL` or `src/config/api.ts`

## Systemd Service (Optional)

For running with a static file server as a system service:

Create `/etc/systemd/system/math2visual-frontend.service`:

```ini
[Unit]
Description=Math2Visual Frontend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/math2visual/frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable math2visual-frontend
sudo systemctl start math2visual-frontend
sudo systemctl status math2visual-frontend
```

## Security Considerations

### Content Security Policy

Add to your web server configuration:

```nginx
# Nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;
```

### HTTPS

Always use HTTPS in production:
- Use Let's Encrypt for free SSL certificates
- Configure automatic renewal
- Redirect HTTP to HTTPS

### File Permissions

```bash
# Secure file permissions
chmod 755 /path/to/math2visual/frontend/dist
chmod 644 /path/to/math2visual/frontend/dist/*
```

## Performance Optimization

### Build Optimizations

The Vite build process automatically:
- Minifies JavaScript and CSS
- Tree-shakes unused code
- Code-splits for optimal loading
- Optimizes images and assets

### Caching Strategy

Configure your web server to cache static assets:

```nginx
# Nginx - Cache static assets for 1 year
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Don't cache HTML (always get latest)
location ~* \.html$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### Compression

Enable gzip/brotli compression in your web server for better performance.

## Monitoring

### Health Checks

```bash
# Check if frontend is serving correctly
curl http://your-domain.com

# Check API connectivity
curl http://your-domain.com/api/system/status
```

### Logs

```bash
# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# Systemd service logs
journalctl -u math2visual-frontend -f
```

## Troubleshooting

### Common Issues

1. **404 Errors on Refresh**
   - Ensure your web server is configured to serve `index.html` for all routes
   - Check URL rewriting rules

2. **API Connection Failed**
   - Verify `VITE_BACKEND_URL` was set during build
   - Check backend is running and accessible
   - Verify CORS settings on backend
   - Check proxy configuration in web server

3. **Build Errors**
   ```bash
   # Clear cache and rebuild
   rm -rf node_modules dist
   npm install
   npm run build
   ```

4. **Static Assets Not Loading**
   - Check file permissions
   - Verify base path configuration
   - Check web server root directory setting

5. **CORS Errors**
   - Ensure backend has CORS enabled
   - Check proxy configuration
   - Verify API endpoint URLs

### Debug Mode

For debugging production issues:

```bash
# Build with source maps
npm run build -- --sourcemap

# Check build output
ls -la dist/

# Test locally with preview
npm run preview
```

## Updating the Application

### Deployment Workflow

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Update dependencies** (if needed)
   ```bash
   npm install
   ```

3. **Rebuild**
   ```bash
   npm run build
   ```

4. **Deploy**
   - Copy `dist/` to web server
   - Or restart service/systemd service
   - Or trigger CI/CD pipeline

### Zero-Downtime Deployment

For zero-downtime deployments:

1. Build new version in a separate directory
2. Test the new build
3. Switch web server root to new directory
4. Reload web server
5. Keep old version as backup

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: cd frontend && npm run build
        env:
          VITE_BACKEND_URL: ${{ secrets.BACKEND_URL }}
      - name: Deploy to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          source: "frontend/dist/*"
          target: "/var/www/math2visual-frontend"
```

## Best Practices

1. **Always use HTTPS** in production
2. **Set proper environment variables** before building
3. **Test the production build** locally before deploying
4. **Use a reverse proxy** (Nginx/Apache) for better performance
5. **Enable compression** (gzip/brotli)
6. **Configure caching** for static assets
7. **Monitor logs** for errors and performance
8. **Keep dependencies updated** regularly
9. **Use CI/CD** for automated deployments
10. **Backup** your deployment configuration

## Related Documentation

- [Backend Production Deployment](../backend/docs/PRODUCTION_DEPLOYMENT.md)
- [Frontend README](../README.md)
- [Vite Documentation](https://vitejs.dev/guide/)
- [Nginx Documentation](https://nginx.org/en/docs/)




















