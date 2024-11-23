#!/bin/bash
# deploy.sh

echo "Starting backend deployment..."

# Define paths
BACKEND_DIR="/home/ubuntu/Pilo-Backend"
DOMAIN="api.pilo.life"

# Install required packages
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

# Get SSL certificate
echo "Setting up SSL certificate..."
sudo certbot certonly --nginx -d $DOMAIN --non-interactive --agree-tos --email your-email@example.com

# Create Nginx configuration
echo "Creating Nginx configuration..."
sudo tee /etc/nginx/nginx.conf > /dev/null << EOL
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # MIME Types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_ciphers EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip Settings
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name $DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

        # Proxy Settings
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;

            # Additional proxy settings
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # Timeouts
            proxy_connect_timeout 60;
            proxy_send_timeout 60;
            proxy_read_timeout 60;

            # CORS headers
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;

            # Handle preflight requests
            if (\$request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*';
                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
                add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
                add_header 'Content-Type' 'text/plain charset=UTF-8';
                add_header 'Content-Length' 0;
                return 204;
            }
        }

        # Health check endpoint
        location /health {
            proxy_pass http://localhost:3000/health;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            
            # Specific timeouts for health check
            proxy_connect_timeout 10;
            proxy_send_timeout 10;
            proxy_read_timeout 10;
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

# Start backend with PM2
echo "Starting backend server..."
if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    if pm2 list | grep -q "pilo-backend"; then
        pm2 restart pilo-backend
    else
        pm2 start index.js --name pilo-backend
    fi
    
    pm2 save
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
else
    echo "❌ Backend directory not found at $BACKEND_DIR"
    exit 1
fi

# Set up SSL auto-renewal
echo "Setting up SSL auto-renewal..."
sudo tee /etc/cron.monthly/ssl-renewal << EOL
#!/bin/bash
certbot renew --quiet --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
EOL
sudo chmod +x /etc/cron.monthly/ssl-renewal

# Final checks
echo "Performing final checks..."

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx failed to start"
fi

if pm2 pid pilo-backend > /dev/null; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server failed to start"
fi

echo "Testing endpoints..."
echo "Testing HTTPS endpoint..."
curl -k https://$DOMAIN/health

echo "Deployment complete!"
echo "You can monitor logs with:"
echo "- Backend logs: pm2 logs"
echo "- Nginx access logs: sudo tail -f /var/log/nginx/access.log"
echo "- Nginx error logs: sudo tail -f /var/log/nginx/error.log"

# Show services status
echo -e "\nService Status:"
pm2 status
sudo systemctl status nginx --no-pager