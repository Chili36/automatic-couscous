# FoodEx2 Code Validator - Deployment Guide

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [System Requirements](#system-requirements)
3. [Pre-deployment Checklist](#pre-deployment-checklist)
4. [Production Setup](#production-setup)
5. [PM2 Deployment](#pm2-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Nginx Configuration](#nginx-configuration)
8. [SSL/TLS Setup](#ssltls-setup)
9. [Database Management](#database-management)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Backup Strategy](#backup-strategy)
12. [Performance Tuning](#performance-tuning)
13. [Security Hardening](#security-hardening)
14. [Troubleshooting](#troubleshooting)
15. [Rollback Procedures](#rollback-procedures)

## Deployment Overview

The FoodEx2 Code Validator can be deployed using several strategies:

- **PM2**: Process manager for Node.js applications (recommended)
- **Docker**: Containerized deployment for consistency
- **Systemd**: Native Linux service management
- **Cloud Platforms**: AWS, Azure, Google Cloud, Heroku

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores @ 2.4GHz
- **RAM**: 4GB
- **Storage**: 10GB SSD
- **OS**: Ubuntu 20.04 LTS / CentOS 8 / Debian 11
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Recommended Requirements

- **CPU**: 4 cores @ 3.0GHz
- **RAM**: 8GB
- **Storage**: 20GB SSD
- **Network**: 100Mbps dedicated
- **OS**: Ubuntu 22.04 LTS

### Software Dependencies

```bash
# System packages
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    git \
    nginx \
    sqlite3 \
    certbot \
    python3-certbot-nginx

# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Optional: Docker
curl -fsSL https://get.docker.com | sh
```

## Pre-deployment Checklist

- [ ] Server meets minimum requirements
- [ ] Domain name configured (if applicable)
- [ ] SSL certificates obtained
- [ ] Firewall rules configured
- [ ] Backup system in place
- [ ] Monitoring tools installed
- [ ] Environment variables configured
- [ ] Database initialized and tested
- [ ] Security audit completed
- [ ] Load testing performed

## Production Setup

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/foodex2-validator
sudo chown $USER:$USER /var/www/foodex2-validator

# Clone repository
cd /var/www
git clone https://github.com/Chili36/automatic-couscous.git foodex2-validator
cd foodex2-validator
```

### 2. Install Dependencies

```bash
# Install backend dependencies
npm ci --production

# Install frontend dependencies
cd client
npm ci --production
cd ..
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit production settings
nano .env
```

Production `.env` configuration:

```bash
# Production Environment
NODE_ENV=production
PORT=5001

# Database
DATABASE_PATH=/var/www/foodex2-validator/data/mtx.db
DATABASE_VERSION=MTX v17.0

# Frontend
VITE_PORT=5178
VITE_API_URL=https://api.yourdomain.com

# Security
SESSION_SECRET=<generate-strong-secret>
CORS_ORIGIN=https://yourdomain.com

# Performance
MAX_BATCH_SIZE=1000
WORKER_THREADS=4
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/foodex2-validator

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Build Frontend

```bash
cd client
npm run build
cd ..
```

### 5. Database Setup

```bash
# Initialize database if not exists
if [ ! -f data/mtx.db ]; then
    node server/setup-database.js
fi

# Verify database
sqlite3 data/mtx.db "SELECT COUNT(*) FROM terms;"
```

## PM2 Deployment

### 1. Configure PM2

Update `ecosystem.config.js` for production:

```javascript
module.exports = {
    apps: [
        {
            name: 'foodex2-backend',
            script: './server/index.js',
            instances: 'max', // Use all CPU cores
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env_production: {
                NODE_ENV: 'production',
                PORT: 5001
            },
            error_file: '/var/log/pm2/foodex2-error.log',
            out_file: '/var/log/pm2/foodex2-out.log',
            merge_logs: true,
            time: true
        }
    ]
};
```

### 2. Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd
# Follow the output instructions

# Monitor
pm2 monit
```

### 3. PM2 Management Commands

```bash
# Status
pm2 status

# Logs
pm2 logs foodex2-backend --lines 100

# Restart
pm2 restart foodex2-backend

# Reload (zero-downtime)
pm2 reload foodex2-backend

# Stop
pm2 stop foodex2-backend

# Delete from PM2
pm2 delete foodex2-backend

# Monitor resources
pm2 monit
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install SQLite
RUN apk add --no-cache sqlite

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --production
RUN cd client && npm ci --production

# Copy application files
COPY . .

# Build frontend
RUN cd client && npm run build

# Create data directory
RUN mkdir -p /data

# Expose ports
EXPOSE 5001

# Set environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/mtx.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# Run application
CMD ["node", "server/index.js"]
```

### 2. Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  foodex2-validator:
    build: .
    container_name: foodex2-validator
    restart: always
    ports:
      - "5001:5001"
    volumes:
      - ./data:/data
      - ./logs:/var/log/foodex2
    environment:
      - NODE_ENV=production
      - PORT=5001
      - DATABASE_PATH=/data/mtx.db
    networks:
      - foodex2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: foodex2-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./client/dist:/usr/share/nginx/html:ro
    networks:
      - foodex2-network
    depends_on:
      - foodex2-validator

networks:
  foodex2-network:
    driver: bridge
```

### 3. Deploy with Docker

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

## Nginx Configuration

### 1. Create Nginx Configuration

```nginx
# /etc/nginx/sites-available/foodex2-validator
upstream foodex2_backend {
    least_conn;
    server 127.0.0.1:5001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/foodex2-access.log combined;
    error_log /var/log/nginx/foodex2-error.log warn;

    # Root directory for frontend
    root /var/www/foodex2-validator/client/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml 
               text/javascript application/x-font-ttf font/opentype;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api {
        proxy_pass http://foodex2_backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Websocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }

    # Static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://foodex2_backend/api/health;
        access_log off;
    }
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

### 2. Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/foodex2-validator /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## SSL/TLS Setup

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run

# Setup auto-renewal cron
echo "0 0,12 * * * root python3 -c 'import random; import time; time.sleep(random.randint(0,3600))' && certbot renew -q" | sudo tee -a /etc/crontab
```

## Database Management

### Backup Strategy

```bash
#!/bin/bash
# /usr/local/bin/backup-foodex2.sh

BACKUP_DIR="/var/backups/foodex2"
DB_PATH="/var/www/foodex2-validator/data/mtx.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_PATH ".backup $BACKUP_DIR/mtx_$DATE.db"

# Compress backup
gzip $BACKUP_DIR/mtx_$DATE.db

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/mtx_$DATE.db.gz s3://your-bucket/backups/
```

### Restore Procedure

```bash
# Stop application
pm2 stop foodex2-backend

# Restore database
gunzip -c /var/backups/foodex2/mtx_20240101_120000.db.gz > /var/www/foodex2-validator/data/mtx.db

# Start application
pm2 start foodex2-backend
```

### Database Optimization

```bash
# Vacuum and analyze database periodically
sqlite3 /var/www/foodex2-validator/data/mtx.db "VACUUM; ANALYZE;"

# Add to crontab
echo "0 3 * * 0 sqlite3 /var/www/foodex2-validator/data/mtx.db 'VACUUM; ANALYZE;'" | sudo tee -a /etc/crontab
```

## Monitoring and Logging

### 1. Application Monitoring with PM2

```javascript
// pm2-metrics.js
const pmx = require('pmx');

pmx.init({
    http: true,
    errors: true,
    custom_probes: true,
    network: true,
    ports: true
});

// Custom metrics
const validationCounter = pmx.counter({
    name: 'Validations'
});

const responseTime = pmx.histogram({
    name: 'Response Time',
    measurement: 'mean'
});

module.exports = { validationCounter, responseTime };
```

### 2. System Monitoring

```bash
# Install monitoring tools
sudo apt-get install -y htop iotop nethogs

# Setup Prometheus Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.5.0/node_exporter-1.5.0.linux-amd64.tar.gz
tar xvf node_exporter-1.5.0.linux-amd64.tar.gz
sudo mv node_exporter-1.5.0.linux-amd64/node_exporter /usr/local/bin/
```

### 3. Log Management

```bash
# Configure logrotate
cat > /etc/logrotate.d/foodex2 << EOF
/var/log/foodex2-validator/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 4. Health Check Script

```javascript
// healthcheck.js
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/health',
    timeout: 5000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

req.on('error', () => {
    process.exit(1);
});

req.end();
```

## Performance Tuning

### 1. Node.js Optimization

```bash
# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable cluster mode in PM2
pm2 start ecosystem.config.js -i max
```

### 2. SQLite Optimization

```sql
-- Performance pragmas
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000000;
```

### 3. Nginx Caching

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/search {
    proxy_cache api_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_use_stale error timeout updating;
    proxy_cache_key "$scheme$request_method$host$request_uri$arg_q";
    add_header X-Cache-Status $upstream_cache_status;
}
```

## Security Hardening

### 1. System Security

```bash
# Install fail2ban
sudo apt-get install fail2ban

# Configure fail2ban for Nginx
cat > /etc/fail2ban/jail.local << EOF
[nginx-req-limit]
enabled = true
filter = nginx-req-limit
logpath = /var/log/nginx/*error.log
maxretry = 10
findtime = 60
bantime = 3600
EOF

# Firewall setup
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Application Security

```javascript
// Security middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 3. Database Security

```bash
# Restrict database file permissions
chmod 600 /var/www/foodex2-validator/data/mtx.db
chown www-data:www-data /var/www/foodex2-validator/data/mtx.db

# Regular security updates
sudo apt-get update && sudo apt-get upgrade -y
```

## Troubleshooting

### Common Issues

**Issue**: Application won't start
```bash
# Check logs
pm2 logs foodex2-backend --lines 100

# Check port availability
sudo lsof -i :5001

# Verify database
sqlite3 data/mtx.db "SELECT COUNT(*) FROM terms;"
```

**Issue**: High memory usage
```bash
# Monitor memory
pm2 monit

# Restart with memory limit
pm2 restart foodex2-backend --max-memory-restart 1G
```

**Issue**: Slow response times
```bash
# Check CPU usage
htop

# Analyze slow queries
sqlite3 data/mtx.db "EXPLAIN QUERY PLAN SELECT ..."

# Enable query logging
export DEBUG=sql:*
```

**Issue**: SSL certificate errors
```bash
# Renew certificate
sudo certbot renew

# Check certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

## Rollback Procedures

### Quick Rollback

```bash
#!/bin/bash
# rollback.sh

# Stop current version
pm2 stop foodex2-backend

# Restore previous version
cd /var/www/foodex2-validator
git checkout HEAD~1

# Restore database backup
gunzip -c /var/backups/foodex2/mtx_latest.db.gz > data/mtx.db

# Reinstall dependencies
npm ci --production
cd client && npm ci --production && npm run build

# Restart application
pm2 start foodex2-backend
```

### Blue-Green Deployment

```bash
# Deploy to staging
pm2 start ecosystem.config.js --name foodex2-staging --env staging

# Test staging
curl http://localhost:5002/api/health

# Switch traffic
# Update Nginx upstream to point to staging port

# Stop old version
pm2 stop foodex2-backend
pm2 delete foodex2-backend

# Rename staging to production
pm2 restart foodex2-staging --name foodex2-backend
```

## Deployment Checklist

### Pre-deployment
- [ ] Code reviewed and tested
- [ ] Database migrations prepared
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Backup system tested
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Security scan performed

### During Deployment
- [ ] Maintenance mode enabled
- [ ] Database backed up
- [ ] Application deployed
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Smoke tests completed
- [ ] Performance verified
- [ ] Logs checked for errors

### Post-deployment
- [ ] Maintenance mode disabled
- [ ] User acceptance testing
- [ ] Monitoring dashboards checked
- [ ] Documentation updated
- [ ] Team notified
- [ ] Backup verification
- [ ] Performance metrics reviewed
- [ ] Security scan re-run

## Support and Resources

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [SQLite Performance](https://www.sqlite.org/optoverview.html)
- [Let's Encrypt](https://letsencrypt.org/docs/)