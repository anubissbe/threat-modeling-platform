#!/bin/bash

echo "=== Debugging Threat Model Creation ==="

# Get auth token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@threatmodel.com", "password": "Admin123!"}')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
echo "Access Token: ${ACCESS_TOKEN:0:50}..."

# Get a project ID
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "Test Project for Threat Model",
    "description": "Test project",
    "type": "web_application",
    "status": "active"
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "Project ID: $PROJECT_ID"

# Try creating threat model with detailed response
echo
echo "Creating threat model with full response..."
THREAT_MODEL_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threat-models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Test Threat Model\",
    \"project_id\": \"$PROJECT_ID\",
    \"methodology\": \"STRIDE\",
    \"description\": \"Test threat model for debugging\",
    \"scope\": {
      \"systems\": [\"Test System\"],
      \"boundaries\": [\"Test Boundary\"],
      \"assets\": [{
        \"id\": \"test-asset\",
        \"name\": \"Test Asset\",
        \"type\": \"data\",
        \"description\": \"Test asset\",
        \"sensitivity\": \"internal\"
      }],
      \"actors\": [{
        \"id\": \"test-actor\",
        \"name\": \"Test Actor\",
        \"type\": \"user\",
        \"description\": \"Test actor\",
        \"trust_level\": \"trusted\"
      }],
      \"data_flows\": [{
        \"id\": \"test-flow\",
        \"name\": \"Test Flow\",
        \"source\": \"Test Source\",
        \"destination\": \"Test Destination\",
        \"data_classification\": \"internal\"
      }]
    }
  }" -v)

echo "Full response:"
echo "$THREAT_MODEL_RESPONSE" | jq .
echo
echo "Response ID only:"
echo "$THREAT_MODEL_RESPONSE" | jq -r '.data.id'