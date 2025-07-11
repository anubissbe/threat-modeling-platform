#!/bin/bash

# Login and get token
echo "1. Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@threatmodel.com", "password": "Admin123"}' | jq -r '.data.accessToken')

echo "Token obtained: ${TOKEN:0:20}..."

# Create a project
echo -e "\n2. Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-Commerce Platform",
    "description": "Main e-commerce platform security assessment",
    "type": "web_application",
    "riskLevel": "High"
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "Project created with ID: $PROJECT_ID"

# Create some vulnerabilities
echo -e "\n3. Creating test vulnerabilities..."
curl -s -X POST http://localhost:3000/api/vulnerabilities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"SQL Injection in Login\",
    \"description\": \"Unvalidated input in login form allows SQL injection\",
    \"severity\": \"Critical\",
    \"projectId\": \"$PROJECT_ID\",
    \"component\": \"auth-service\",
    \"status\": \"open\",
    \"priority\": \"P1\"
  }" > /dev/null

curl -s -X POST http://localhost:3000/api/vulnerabilities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"XSS in User Comments\",
    \"description\": \"User comments not properly sanitized\",
    \"severity\": \"High\",
    \"projectId\": \"$PROJECT_ID\",
    \"component\": \"comment-service\",
    \"status\": \"open\",
    \"priority\": \"P2\"
  }" > /dev/null

echo "Vulnerabilities created"

# Create a threat model and threats
echo -e "\n4. Creating threat model..."
THREAT_MODEL_RESPONSE=$(curl -s -X POST http://localhost:3000/api/threat-models \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"E-Commerce Threat Model\",
    \"project_id\": \"$PROJECT_ID\",
    \"description\": \"Threat model for e-commerce platform\",
    \"methodology\": \"STRIDE\",
    \"version\": \"1.0\",
    \"status\": \"active\",
    \"scope\": {
      \"included\": [\"Web application\", \"Payment system\", \"User authentication\"],
      \"excluded\": [\"Third-party services\", \"Physical security\"]
    }
  }")

THREAT_MODEL_ID=$(echo "$THREAT_MODEL_RESPONSE" | jq -r '.data.id')
echo "Threat model created with ID: $THREAT_MODEL_ID"

# Create threats
echo -e "\n5. Creating threats..."
curl -s -X POST http://localhost:3000/api/threats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Data Breach via API\",
    \"threat_model_id\": \"$THREAT_MODEL_ID\",
    \"category\": \"Information Disclosure\",
    \"likelihood\": \"High\",
    \"impact\": \"Critical\",
    \"description\": \"Unauthorized API access could expose customer data\",
    \"status\": \"identified\",
    \"affected_component\": \"API Gateway\"
  }" > /dev/null

curl -s -X POST http://localhost:3000/api/threats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"DDoS Attack\",
    \"threat_model_id\": \"$THREAT_MODEL_ID\",
    \"category\": \"Denial of Service\",
    \"likelihood\": \"Medium\",
    \"impact\": \"High\",
    \"description\": \"Service could be overwhelmed by traffic\",
    \"status\": \"identified\",
    \"affected_component\": \"Web Server\"
  }" > /dev/null

echo "Threats created"

# Create a risk assessment
echo -e "\n6. Creating risk assessment..."
ASSESSMENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/risk-assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"assessmentType\": \"automated\"
  }")

ASSESSMENT_ID=$(echo "$ASSESSMENT_RESPONSE" | jq -r '.data.data.id')
echo "Risk assessment created with ID: $ASSESSMENT_ID"

# Wait for assessment to complete
echo -e "\n7. Waiting for assessment to complete..."
sleep 2

# Get the assessment details
echo -e "\n8. Fetching assessment details..."
ASSESSMENT_DETAILS=$(curl -s http://localhost:3000/api/risk-assessments/$ASSESSMENT_ID \
  -H "Authorization: Bearer $TOKEN")

echo -e "\nRisk Assessment Results:"
echo "$ASSESSMENT_DETAILS" | jq '{
  id: .data.id,
  projectName: .data.projectName,
  overallRisk: .data.overallRisk,
  score: .data.score,
  status: .data.status,
  vulnerabilityCount: (.data.vulnerabilities | length),
  threatCount: (.data.threats | length),
  recommendationCount: (.data.recommendations | length)
}'

echo -e "\nRecommendations:"
echo "$ASSESSMENT_DETAILS" | jq -r '.data.recommendations[] | "- [\(.priority)] \(.recommendation)"'

echo -e "\nDone! You can now view the risk assessment at:"
echo "http://localhost:3006/risk-assessment"
echo "(Login with admin@threatmodel.com / Admin123)"