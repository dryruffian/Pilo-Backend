#!/bin/bash
# deploy.sh

echo "Starting backend deployment..."

# Install required packages if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Create Nginx configuration
echo "Creating Nginx configuration..."
sudo tee /etc/nginx/nginx.conf > /dev/null << 'EOL'
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

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Main Server Block
    server {
        listen 80;
        server_name _;  # Catch all requests

        # Proxy Settings
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;

            # Additional proxy settings
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60;
            proxy_send_timeout 60;
            proxy_read_timeout 60;

            # CORS headers
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

        # Health check endpoint
        location /health {
            proxy_pass http://localhost:3000/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
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
cd /home/ubuntu/pilo-backend  # Adjust this path to your backend directory
pm2 delete all || true
pm2 start index.js --name pilo-backend

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

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

# Wait for services to fully start
echo "Waiting for services to start..."
sleep 5

# Test the endpoints
echo -e "\nTesting endpoints..."
echo "Testing direct backend endpoint..."
curl -I http://localhost:3000/health
echo -e "\nTesting Nginx proxied endpoint..."
curl -I http://localhost/health

echo "Deployment complete!"
echo "You can monitor logs with:"
echo "- Backend logs: pm2 logs"
echo "- Nginx access logs: sudo tail -f /var/log/nginx/access.log"
echo "- Nginx error logs: sudo tail -f /var/log/nginx/error.log"

# Show services status
echo -e "\nService Status:"
pm2 status
sudo systemctl status nginx --no-pager