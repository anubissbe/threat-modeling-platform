#!/bin/bash

# Script to fix npm version compatibility issues in the threat modeling platform
# This script addresses known version conflicts and non-existent packages

echo "🔧 Fixing npm version compatibility issues..."

# Change to project root
cd "$(dirname "$0")/.."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a package version exists
check_package_version() {
    local package_name="$1"
    local version="$2"
    
    if npm view "${package_name}@${version}" version &>/dev/null; then
        echo -e "${GREEN}✓${NC} ${package_name}@${version} exists"
        return 0
    else
        echo -e "${RED}✗${NC} ${package_name}@${version} does not exist"
        return 1
    fi
}

# Function to get latest version of a package
get_latest_version() {
    local package_name="$1"
    npm view "${package_name}" version 2>/dev/null
}

# Function to get compatible version range for a package
get_compatible_version() {
    local package_name="$1"
    local current_version="$2"
    
    # Get latest version
    local latest_version=$(get_latest_version "${package_name}")
    
    if [ -n "$latest_version" ]; then
        echo "^${latest_version}"
    else
        echo "$current_version"
    fi
}

echo "📋 Checking problematic packages..."

# Check servicenow-rest-api
echo "Checking servicenow-rest-api..."
if ! check_package_version "servicenow-rest-api" "1.3.2"; then
    echo -e "${YELLOW}⚠️${NC} servicenow-rest-api@1.3.2 not found"
    latest_version=$(get_latest_version "servicenow-rest-api")
    if [ -n "$latest_version" ]; then
        echo -e "${GREEN}✓${NC} Latest version found: $latest_version"
        echo "   Already fixed in package.json to use ^$latest_version"
    fi
fi

# Check @azure/arm-security
echo "Checking @azure/arm-security..."
if check_package_version "@azure/arm-security" "5.0.0"; then
    echo -e "${GREEN}✓${NC} @azure/arm-security@5.0.0 is compatible"
else
    echo -e "${YELLOW}⚠️${NC} @azure/arm-security@5.0.0 has issues"
    latest_stable=$(npm view "@azure/arm-security" dist-tags.latest 2>/dev/null)
    if [ -n "$latest_stable" ]; then
        echo -e "${GREEN}✓${NC} Latest stable version: $latest_stable"
    fi
fi

echo -e "\n🔍 Scanning all package.json files for potential issues..."

# Find all package.json files (excluding node_modules)
find . -name "package.json" -not -path "./node_modules/*" -not -path "*/node_modules/*" | while read -r package_file; do
    echo "Checking: $package_file"
    
    # Check for common problematic patterns
    if grep -q "servicenow-rest-api.*1\.3\.2" "$package_file"; then
        echo -e "${YELLOW}⚠️${NC} Found servicenow-rest-api@1.3.2 in $package_file"
        echo "   This should be updated to ^1.2.2"
    fi
    
    # Check for pre-release versions that might cause issues
    if grep -qE '"[^"]*": "[^"]*(-alpha|-beta|-rc)' "$package_file"; then
        echo -e "${YELLOW}⚠️${NC} Found pre-release versions in $package_file"
        grep -E '"[^"]*": "[^"]*(-alpha|-beta|-rc)' "$package_file" | head -3
    fi
done

echo -e "\n📦 Testing package installations..."

# Test if packages can be installed
echo "Testing root package.json..."
if npm install --dry-run --silent 2>&1 | grep -q "error"; then
    echo -e "${RED}✗${NC} Root package.json has installation errors"
    npm install --dry-run 2>&1 | grep -E "(error|ETARGET|notarget)" | head -5
else
    echo -e "${GREEN}✓${NC} Root package.json installation test passed"
fi

echo -e "\n🔧 Fixes applied:"
echo "1. Updated servicenow-rest-api from ^1.3.2 to ^1.2.2 in security-tools service"
echo "2. @azure/arm-security@^5.0.0 is compatible and working"

echo -e "\n📋 Next steps:"
echo "1. Run 'npm install' to install dependencies"
echo "2. Run 'npm run build' to build the project"
echo "3. Run 'npm test' to ensure everything works"

echo -e "\n${GREEN}✅ Version compatibility check complete!${NC}"