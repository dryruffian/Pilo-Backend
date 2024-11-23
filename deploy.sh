#!/bin/bash
# deploy.sh

echo "Starting backend deployment..."

# Install required packages if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt install -y nginx
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Stop nginx temporarily
sudo systemctl stop nginx

# Get SSL certificate if not already present
if [ ! -f /etc/letsencrypt/live/api.pilo.life/fullchain.pem ]; then
    echo "Obtaining SSL certificate..."
    sudo certbot certonly --standalone -d api.pilo.life
fi

# Create Nginx configuration
echo "Creating Nginx configuration..."
sudo tee /etc/nginx/nginx.conf > /dev/null << 'EOL'
events {
    worker_connections 768;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # API Server Configuration
    server {
        listen 80;
        server_name api.pilo.life;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name api.pilo.life;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/api.pilo.life/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.pilo.life/privkey.pem;

        # Security Settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        # Proxy Settings
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;

            # Headers
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;

            # Handle preflight requests
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*';
                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
                add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
                add_header 'Content-Type' 'text/plain charset=UTF-8';
                add_header 'Content-Length' 0;
                return 204;
            }
        }
    }
}
EOL

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx configuration is valid"
    sudo systemctl restart nginx
else
    echo "Nginx configuration is invalid"
    exit 1
fi

# Set up SSL auto-renewal
echo "Setting up SSL auto-renewal..."
sudo tee /etc/cron.monthly/ssl-renewal > /dev/null << 'EOL'
#!/bin/bash
certbot renew --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
EOL

sudo chmod +x /etc/cron.monthly/ssl-renewal

# Start backend with PM2
echo "Starting backend server..."
cd /home/ubuntu/pilo-backend  # Adjust this path to your backend directory
pm2 delete all || true
pm2 start index.js --name pilo-backend

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

echo "Setting up log rotation..."
sudo tee /etc/logrotate.d/nginx > /dev/null << 'EOL'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi \
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
EOL

# Final checks
echo "Performing final checks..."

# Check if Nginx is running
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx failed to start"
fi

# Check if PM2 process is running
if pm2 pid pilo-backend > /dev/null; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server failed to start"
fi

# Test SSL certificate
echo "Testing SSL certificate..."
if curl -s -k https://api.pilo.life > /dev/null; then
    echo "✅ SSL certificate is working"
else
    echo "❌ SSL certificate test failed"
fi

echo "Deployment complete!"
echo "You can monitor logs with:"
echo "- Backend logs: pm2 logs"
echo "- Nginx access logs: sudo tail -f /var/log/nginx/access.log"
echo "- Nginx error logs: sudo tail -f /var/log/nginx/error.log"

# Show services status
echo -e "\nService Status:"
pm2 status
sudo systemctl status nginx --no-pager

# Test the endpoint
echo -e "\nTesting API endpoint..."
curl -k -I https://api.pilo.life