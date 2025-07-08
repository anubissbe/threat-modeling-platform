#!/bin/sh

# Environment variable defaults
API_GATEWAY_URL=${API_GATEWAY_URL:-"http://api-gateway:3000"}
ENVIRONMENT=${ENVIRONMENT:-"production"}

echo "Starting Threat Modeling Platform Frontend..."
echo "API Gateway URL: $API_GATEWAY_URL"
echo "Environment: $ENVIRONMENT"

# Nginx config is already configured with hardcoded API Gateway URL for simplicity

# Create runtime config file for the frontend
cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  API_BASE_URL: '$API_GATEWAY_URL',
  ENVIRONMENT: '$ENVIRONMENT',
  VERSION: '1.0.0'
};
EOF

echo "Configuration complete. Starting nginx..."

# Execute the command passed to docker run
exec "$@"