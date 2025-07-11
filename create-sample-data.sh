#!/bin/bash

echo "=== Creating Sample Data for Threat Modeling Platform ==="
echo

# Get auth token
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@threatmodel.com", "password": "Admin123!"}')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
echo "Logged in successfully"

# Create a project
echo
echo "2. Creating sample project..."
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "E-Commerce Platform Security Assessment",
    "description": "Comprehensive threat modeling for our new e-commerce platform",
    "type": "web_application",
    "status": "active",
    "riskProfile": "high",
    "tags": ["e-commerce", "web", "customer-facing"]
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "Created project: $PROJECT_ID"

# Create a threat model
echo
echo "3. Creating threat model..."
THREAT_MODEL_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threat-models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Customer Authentication Flow\",
    \"project_id\": \"$PROJECT_ID\",
    \"methodology\": \"STRIDE\",
    \"description\": \"Threat model for customer login and authentication process\",
    \"assumptions\": [\"Users will use strong passwords\", \"TLS 1.3 is properly configured\"],
    \"scope\": {
      \"systems\": [\"Authentication Service\", \"User Database\", \"Session Manager\"],
      \"boundaries\": [\"Internet\", \"DMZ\", \"Internal Network\"],
      \"assets\": [{
        \"id\": \"asset-1\",
        \"name\": \"User Credentials\",
        \"type\": \"data\",
        \"description\": \"Username and password combinations\",
        \"sensitivity\": \"secret\"
      }],
      \"actors\": [{
        \"id\": \"actor-1\",
        \"name\": \"External User\",
        \"type\": \"user\",
        \"description\": \"Customer accessing the platform\",
        \"trust_level\": \"untrusted\"
      }],
      \"data_flows\": [{
        \"id\": \"flow-1\",
        \"name\": \"Login Request\",
        \"source\": \"External User\",
        \"destination\": \"Authentication Service\",
        \"data_classification\": \"confidential\",
        \"encryption\": \"TLS 1.3\"
      }]
    }
  }")

THREAT_MODEL_ID=$(echo "$THREAT_MODEL_RESPONSE" | jq -r '.data.id')
echo "Created threat model: $THREAT_MODEL_ID"

# Create threats
echo
echo "4. Creating sample threats..."

# Threat 1: SQL Injection
THREAT1_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"SQL Injection in Login Form\",
    \"description\": \"Attacker could inject malicious SQL through login form fields to bypass authentication or extract sensitive data\",
    \"category\": \"Tampering\",
    \"threat_model_id\": \"$THREAT_MODEL_ID\",
    \"severity\": \"critical\",
    \"likelihood\": \"high\",
    \"status\": \"identified\",
    \"affected_assets\": [\"asset-1\"],
    \"threat_actors\": [\"actor-1\"]
  }")
echo "Created threat: SQL Injection"

# Threat 2: Brute Force
THREAT2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Brute Force Attack on Login\",
    \"description\": \"Attacker attempts multiple password combinations to gain unauthorized access to user accounts\",
    \"category\": \"Information Disclosure\",
    \"threat_model_id\": \"$THREAT_MODEL_ID\",
    \"severity\": \"high\",
    \"likelihood\": \"very_high\",
    \"status\": \"analyzing\",
    \"affected_assets\": [\"asset-1\"],
    \"threat_actors\": [\"actor-1\"]
  }")
echo "Created threat: Brute Force Attack"

# Threat 3: Session Hijacking
THREAT3_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Session Token Theft via XSS\",
    \"description\": \"Attacker steals session tokens through cross-site scripting vulnerability in user-generated content\",
    \"category\": \"Elevation of Privilege\",
    \"threat_model_id\": \"$THREAT_MODEL_ID\",
    \"severity\": \"critical\",
    \"likelihood\": \"medium\",
    \"status\": \"mitigating\",
    \"affected_assets\": [\"asset-1\"],
    \"threat_actors\": [\"actor-1\"]
  }")
echo "Created threat: Session Hijacking"

# Create another project for diversity
echo
echo "5. Creating second project..."
PROJECT2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "Mobile Banking App",
    "description": "Security assessment for mobile banking application",
    "type": "mobile_app",
    "status": "in_progress",
    "riskProfile": "critical",
    "tags": ["mobile", "banking", "financial"]
  }')

PROJECT2_ID=$(echo "$PROJECT2_RESPONSE" | jq -r '.data.id')
echo "Created second project: $PROJECT2_ID"

# Create assets
echo
echo "6. Creating sample assets..."
ASSET1_RESPONSE=$(curl -s -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Customer Database\",
    \"type\": \"data\",
    \"description\": \"PostgreSQL database containing customer PII and payment information\",
    \"projectId\": \"$PROJECT_ID\",
    \"criticality\": \"critical\",
    \"dataClassification\": \"confidential\"
  }")
echo "Created asset: Customer Database"

ASSET2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"name\": \"Authentication API\",
    \"type\": \"service\",
    \"description\": \"REST API handling user authentication and session management\",
    \"projectId\": \"$PROJECT_ID\",
    \"criticality\": \"high\",
    \"dataClassification\": \"internal\"
  }")
echo "Created asset: Authentication API"

echo
echo "=== Sample data created successfully! ==="
echo
echo "You can now log in to the application at http://localhost:3006"
echo "Email: admin@threatmodel.com"
echo "Password: Admin123!"