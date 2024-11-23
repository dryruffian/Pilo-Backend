#!/bin/bash
# deploy.sh

# Directory paths
FRONTEND_DIR="/home/ubuntu/pilo-frontend"
BACKEND_DIR="/home/ubuntu/pilo-backend"
NGINX_SITES="/etc/nginx/sites-available"

echo "Starting deployment process..."
# Start backend with PM2
echo "Starting backend server..."
cd $BACKEND_DIR
npm install
pm2 delete all || true
pm2 start index.js --name pilo-backend

# Create Nginx configuration
echo "Configuring Nginx..."
sudo tee $NGINX_SITES/pilo.conf > /dev/null <<EOF
events {
    worker_connections 768;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Optimization
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend server
    server {
        listen 80;
        server_name www.pilo.life;
        return 301 https://\$server_name\$request_uri;
    }

    server {
        listen 443 ssl;
        server_name www.pilo.life;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/www.pilo.life/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/www.pilo.life/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";

        root $FRONTEND_DIR/dist;
        index index.html;

        # Static file caching
        location /assets {
            expires 1y;
            add_header Cache-Control "public, no-transform";
        }

        # Handle React routing
        location / {
            try_files \$uri \$uri/ /index.html;
            add_header Cache-Control "no-cache";
        }
    }

    # API server
    server {
        listen 80;
        server_name api.pilo.life;
        return 301 https://\$server_name\$request_uri;
    }

    server {
        listen 443 ssl;
        server_name api.pilo.life;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/api.pilo.life/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.pilo.life/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "DENY";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # CORS headers
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
        }
    }
}
EOF

# Enable the site and restart Nginx
sudo ln -sf $NGINX_SITES/pilo.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

echo "Deployment complete!"