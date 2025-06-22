#!/bin/bash

# Database Migration Runner Script
# Usage: ./run-migrations.sh [environment]

# Set environment (default to development)
ENV=${1:-development}

# Database configuration
if [ "$ENV" = "production" ]; then
    DB_HOST=${DB_HOST:-"localhost"}
    DB_PORT=${DB_PORT:-"5432"}
    DB_NAME=${DB_NAME:-"threatmodel_prod"}
    DB_USER=${DB_USER:-"threatmodel_user"}
    DB_PASS=${DB_PASS}
elif [ "$ENV" = "staging" ]; then
    DB_HOST=${DB_HOST:-"localhost"}
    DB_PORT=${DB_PORT:-"5432"}
    DB_NAME=${DB_NAME:-"threatmodel_staging"}
    DB_USER=${DB_USER:-"threatmodel_user"}
    DB_PASS=${DB_PASS}
else
    # Development settings
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="threatmodel_dev"
    DB_USER="threatmodel_user"
    DB_PASS="threatmodel_dev_pass"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running database migrations for environment: $ENV${NC}"
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Create migrations table if it doesn't exist
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create migrations table${NC}"
    exit 1
fi

# Get list of migration files
MIGRATION_DIR="$(dirname "$0")/migrations"
MIGRATIONS=$(ls $MIGRATION_DIR/*.sql | sort)

# Execute each migration
for migration in $MIGRATIONS; do
    filename=$(basename "$migration")
    
    # Check if migration has already been executed
    EXECUTED=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM migrations WHERE filename = '$filename'")
    
    if [ $EXECUTED -eq 0 ]; then
        echo -e "${YELLOW}Executing migration: $filename${NC}"
        
        # Execute the migration
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
        
        if [ $? -eq 0 ]; then
            # Record successful migration
            PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "INSERT INTO migrations (filename) VALUES ('$filename')"
            echo -e "${GREEN}✓ Migration $filename completed successfully${NC}"
        else
            echo -e "${RED}✗ Migration $filename failed${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Migration $filename already executed${NC}"
    fi
done

echo -e "${GREEN}All migrations completed successfully!${NC}"

# Show current migration status
echo -e "\n${YELLOW}Current migration status:${NC}"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT filename, executed_at FROM migrations ORDER BY executed_at"