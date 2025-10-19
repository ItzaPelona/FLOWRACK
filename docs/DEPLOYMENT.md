# FlowRack Deployment Guide

This guide covers deploying FlowRack Warehouse Management System on Hostinger and other hosting platforms.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Production Deployment on Hostinger](#production-deployment-on-hostinger)
- [Alternative Hosting Platforms](#alternative-hosting-platforms)
- [SSL Configuration](#ssl-configuration)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

### System Requirements
- Python 3.8 or higher
- PostgreSQL 12 or higher
- Node.js 16+ (optional, for development tools)
- Git

### Hostinger Requirements
- Business or Premium hosting plan with Python support
- PostgreSQL database access
- SSL certificate (included with most plans)
- Domain name

## Local Development Setup

### 1. Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url>
cd flowrack

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Install PostgreSQL and create database
createdb flowrack
createuser flowrack_user --password

# Copy environment file
cp .env.example .env

# Edit .env file with your database credentials
```

### 3. Initialize Database

```bash
# Run database initialization
python backend/database/init_db.py
```

### 4. Run Development Server

```bash
# Start the Flask application
python -m backend.app
```

Access the application at `http://localhost:5000`

## Production Deployment on Hostinger

### Step 1: Prepare Files for Upload

1. **Create Production Environment File**
```bash
# Create .env file with production settings
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-very-secure-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key-change-this
DATABASE_URL=postgresql://username:password@host:port/database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

2. **Create Production Requirements**
```bash
# Create production requirements file
echo "gunicorn==21.2.0" >> requirements-prod.txt
cat requirements.txt >> requirements-prod.txt
```

3. **Create WSGI Entry Point**
```python
# Create wsgi.py file
from backend.app import app, socketio

if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000)
```

### Step 2: Upload Files to Hostinger

1. **Via File Manager (Recommended)**
   - Login to Hostinger control panel
   - Open File Manager
   - Navigate to `public_html` directory
   - Upload all project files

2. **Via FTP/SFTP**
```bash
# Using scp or rsync
scp -r ./flowrack user@your-server.com:/path/to/public_html/
```

### Step 3: Database Configuration

1. **Create PostgreSQL Database**
   - Login to Hostinger control panel
   - Go to "Databases" section
   - Create new PostgreSQL database
   - Note down connection details

2. **Initialize Database**
```bash
# SSH into your server and run
cd /path/to/your/app
python backend/database/init_db.py
```

### Step 4: Python Environment Setup

1. **Create Virtual Environment on Server**
```bash
# SSH into server
ssh user@your-server.com

# Navigate to app directory
cd public_html/flowrack

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements-prod.txt
```

### Step 5: Web Server Configuration

1. **Create .htaccess File**
```apache
# .htaccess for Apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /wsgi.py/$1 [QSA,L]

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static files
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
</IfModule>
```

2. **Configure Python Application**
```python
# passenger_wsgi.py (for Passenger-based hosting)
import sys
import os

# Add your project directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from backend.app import app as application

if __name__ == '__main__':
    application.run()
```

### Step 6: SSL Configuration

1. **Enable SSL in Hostinger Panel**
   - Go to SSL section in control panel
   - Enable SSL for your domain
   - Choose "Let's Encrypt" for free SSL

2. **Force HTTPS**
```apache
# Add to .htaccess
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Step 7: Environment Variables

1. **Set Environment Variables**
```bash
# In your hosting panel or via SSH
export FLASK_ENV=production
export SECRET_KEY="your-secret-key"
export DATABASE_URL="postgresql://user:pass@host:port/db"
```

## Alternative Hosting Platforms

### DigitalOcean App Platform

1. **Create app.yaml**
```yaml
name: flowrack
services:
- name: web
  source_dir: /
  github:
    repo: your-username/flowrack
    branch: main
  run_command: gunicorn --bind :$PORT backend.app:app
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: FLASK_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
databases:
- name: db
  engine: PG
  version: "13"
  size_slug: db-s-dev-database
```

### Heroku Deployment

1. **Create Procfile**
```
web: gunicorn backend.app:app
release: python backend/database/init_db.py
```

2. **Create runtime.txt**
```
python-3.9.16
```

3. **Deploy Commands**
```bash
heroku create flowrack-app
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set FLASK_ENV=production
git push heroku main
```

### AWS EC2 Deployment

1. **Install Dependencies**
```bash
sudo apt update
sudo apt install python3 python3-pip postgresql nginx
```

2. **Configure Nginx**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /static {
        alias /path/to/flowrack/frontend;
        expires 1y;
    }
}
```

3. **Create Systemd Service**
```ini
[Unit]
Description=FlowRack App
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/path/to/flowrack
Environment="PATH=/path/to/flowrack/venv/bin"
ExecStart=/path/to/flowrack/venv/bin/gunicorn --bind 127.0.0.1:5000 backend.app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_requests_user_status ON requests(user_id, status);
CREATE INDEX idx_request_items_request_product ON request_items(request_id, product_id);
CREATE INDEX idx_debts_user_status ON debts(user_id, status);
```

### 2. Application Optimization

```python
# Use connection pooling
from psycopg2 import pool

connection_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=5,
    maxconn=20,
    **DB_CONFIG
)
```

### 3. Frontend Optimization

```javascript
// Enable service worker for caching
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

// Lazy load images
const images = document.querySelectorAll('img[data-src]');
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
        }
    });
});
```

### 4. CDN Configuration

```html
<!-- Use CDN for static assets -->
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
```

## Monitoring and Maintenance

### 1. Health Check Endpoint

```python
@app.route('/health')
def health_check():
    try:
        # Test database connection
        db.execute_query("SELECT 1", fetch=True)
        return {'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}
    except Exception as e:
        return {'status': 'unhealthy', 'error': str(e)}, 500
```

### 2. Logging Configuration

```python
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler('logs/flowrack.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
```

### 3. Backup Script

```bash
#!/bin/bash
# backup.sh - Database backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="flowrack"

# Create backup
pg_dump -U $DB_USER -h $DB_HOST $DB_NAME | gzip > $BACKUP_DIR/flowrack_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "flowrack_*.sql.gz" -mtime +7 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/flowrack_$DATE.sql.gz s3://your-backup-bucket/
```

### 4. Monitoring Script

```python
# monitor.py - Simple monitoring script
import requests
import smtplib
from email.mime.text import MIMEText

def check_health():
    try:
        response = requests.get('https://your-domain.com/health', timeout=30)
        if response.status_code != 200:
            send_alert(f"Health check failed: {response.status_code}")
    except Exception as e:
        send_alert(f"Health check error: {str(e)}")

def send_alert(message):
    msg = MIMEText(message)
    msg['Subject'] = 'FlowRack Alert'
    msg['From'] = 'monitoring@yourcompany.com'
    msg['To'] = 'admin@yourcompany.com'
    
    smtp = smtplib.SMTP('localhost')
    smtp.send_message(msg)
    smtp.quit()

if __name__ == "__main__":
    check_health()
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
```bash
# Check database connectivity
psql -h hostname -U username -d database_name

# Check PostgreSQL service
sudo systemctl status postgresql
```

2. **Permission Errors**
```bash
# Fix file permissions
chmod 644 *.py
chmod 755 directories
chown www-data:www-data /path/to/app
```

3. **Memory Issues**
```bash
# Check memory usage
free -h
htop

# Optimize gunicorn workers
gunicorn --workers=2 --threads=2 backend.app:app
```

4. **SSL Issues**
```bash
# Test SSL certificate
openssl s_client -connect yourdomain.com:443

# Check certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Log Analysis

```bash
# Monitor application logs
tail -f /path/to/logs/flowrack.log

# Check web server logs
tail -f /var/log/apache2/error.log
tail -f /var/log/nginx/error.log

# Monitor database logs
tail -f /var/log/postgresql/postgresql-13-main.log
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS encryption
- [ ] Set up proper file permissions
- [ ] Configure firewall rules
- [ ] Enable database encryption
- [ ] Set up regular backups
- [ ] Configure rate limiting
- [ ] Enable security headers
- [ ] Monitor access logs
- [ ] Keep dependencies updated

## Support and Updates

For support and updates:
- Check the GitHub repository for issues and updates
- Monitor application logs regularly
- Keep dependencies updated with security patches
- Test updates in a staging environment first

Remember to replace placeholder values (domains, passwords, etc.) with your actual production values.