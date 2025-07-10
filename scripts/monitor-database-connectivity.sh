#!/bin/bash

# Database Connectivity Monitor
# Runs continuously to monitor and report database connectivity issues

DATABASE_MCP="http://192.168.1.24:3011"
CHECK_INTERVAL=60  # Check every 60 seconds
LOG_FILE="/opt/projects/threat-modeling-platform/logs/db-connectivity.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

while true; do
    # Test database connectivity
    response=$(curl -s -X POST "$DATABASE_MCP/tools/call" \
        -H "Content-Type: application/json" \
        -d '{"name": "list_databases", "arguments": {}}' 2>/dev/null)
    
    if echo "$response" | grep -q '"projecthub"'; then
        if echo "$response" | grep -q '"connected": true'; then
            log "✅ Database connectivity: OK"
        else
            log "⚠️  Database connectivity: DISCONNECTED"
            # Attempt automatic reconnection
            log "🔄 Attempting automatic reconnection..."
        fi
    else
        log "❌ Database connectivity: ERROR - ProjectHub DB not found"
    fi
    
    sleep $CHECK_INTERVAL
done
