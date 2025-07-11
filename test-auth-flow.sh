#!/bin/bash

echo "=== Testing Authentication Flow ==="
echo

# Test 1: Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@threatmodel.com", "password": "Admin123!"}')

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq .

# Extract tokens
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken')

echo
echo "Extracted tokens:"
echo "Access token length: ${#ACCESS_TOKEN}"
echo "Refresh token length: ${#REFRESH_TOKEN}"
echo "Access token first 50 chars: ${ACCESS_TOKEN:0:50}..."

# Test 2: Profile request with token
echo
echo "2. Testing profile request with token..."
PROFILE_RESPONSE=$(curl -s http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Profile response:"
echo "$PROFILE_RESPONSE" | jq .

# Test 3: Test a protected endpoint
echo
echo "3. Testing protected projects endpoint..."
PROJECTS_RESPONSE=$(curl -s http://localhost:3000/api/projects \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Projects response:"
echo "$PROJECTS_RESPONSE" | jq .

echo
echo "=== End of test ==="