# SSL/TLS Setup with Let's Encrypt

This guide explains how to set up SSL certificates using Let's Encrypt for the Math2Visual Docker container using Docker Compose.

## Prerequisites

- Domain name pointing to your server
- Ports 80 and 443 open in your firewall
- Docker and Docker Compose installed

## Setup Instructions

### Step 1: Update Configuration

Edit `nginx.conf` and replace `YOUR_DOMAIN` with your actual domain name:

```bash
sed -i 's/YOUR_DOMAIN/your-domain.com/g' nginx.conf
```

Or manually edit the file and replace both occurrences of `YOUR_DOMAIN`.

### Step 2: Create Certificate Directories

```bash
mkdir -p certbot/conf certbot/www
```

### Step 3: Start Container (HTTP Only)

Start the container to allow certificate validation:

```bash
docker compose up -d app
```

### Step 4: Obtain SSL Certificate

Run certbot to obtain your certificate:

```bash
sudo docker compose run --rm certbot-init \
  certonly --webroot \
  -w /var/www/certbot \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

**Important:** Replace:
- `your-domain.com` with your actual domain
- `your-email@example.com` with your email address

### Step 5: Restart Container with HTTPS

After the certificate is obtained, restart the container:

```bash
docker compose restart app
```

### Step 6: Start Certificate Renewal Service

The renewal service automatically renews certificates before they expire:

```bash
docker compose up -d certbot-renew
```

## Verification

### Test HTTPS

Visit your site: `https://your-domain.com`

### Test SSL Configuration

Visit: https://www.ssllabs.com/ssltest/

### Check Certificate Expiry

```bash
docker compose exec certbot-renew certbot certificates
```

## Automatic Renewal

The `certbot-renew` service automatically:
- Checks for certificates that need renewal every 12 hours
- Renews certificates 30 days before expiry
- Reloads Nginx after successful renewal

## Troubleshooting

### Certificate Not Found

- Ensure `nginx.conf` has the correct domain name
- Verify certificate files exist: `ls -la certbot/conf/live/your-domain.com/`
- Check file permissions

### Renewal Fails

- Check certbot logs: `docker compose logs certbot-renew`
- Ensure port 80 is accessible for validation
- Verify webroot path is correct

### Nginx Won't Start

- Test nginx config: `docker compose exec app nginx -t`
- Check logs: `docker compose logs app`
- Verify certificate paths in `nginx.conf`

### Domain Validation Fails

- Ensure your domain DNS points to your server
- Verify port 80 is accessible from the internet
- Check firewall rules

## Security Notes

- Certificates are mounted read-only in the container
- Automatic renewal is configured
- Strong SSL protocols (TLS 1.2+) are enabled
- HSTS header is configured for security
- Keep certbot and nginx updated

## Maintenance

### Manual Renewal

If you need to manually renew:

```bash
docker compose run --rm certbot-renew certbot renew
docker compose exec app nginx -s reload
```

### View Certificates

```bash
docker compose exec certbot-renew certbot certificates
```

### Check Renewal Logs

```bash
docker compose logs certbot-renew
```
