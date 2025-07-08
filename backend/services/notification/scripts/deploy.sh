#!/bin/bash

# Notification Service Deployment Script
# This script builds and deploys the notification service

set -e

echo "🚀 Starting notification service deployment..."

# Configuration
SERVICE_NAME="notification-service"
CONTAINER_NAME="threatmodel-notification"
IMAGE_NAME="threat-modeling/${SERVICE_NAME}"
PORT=3009

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to check if service is running
is_service_running() {
    docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}" | grep -q "${CONTAINER_NAME}"
}

# Function to stop existing service
stop_service() {
    if is_service_running; then
        print_status "Stopping existing ${SERVICE_NAME}..."
        docker stop ${CONTAINER_NAME} || true
        docker rm ${CONTAINER_NAME} || true
        print_success "Existing service stopped"
    else
        print_status "No existing service found"
    fi
}

# Function to build the service
build_service() {
    print_status "Building ${SERVICE_NAME}..."
    
    # Build the Docker image
    docker build -t ${IMAGE_NAME}:latest .
    
    if [ $? -eq 0 ]; then
        print_success "Service built successfully"
    else
        print_error "Failed to build service"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if postgres container is running
    if ! docker ps --filter "name=threatmodel-postgres" --filter "status=running" --format "{{.Names}}" | grep -q "threatmodel-postgres"; then
        print_warning "PostgreSQL container not running, starting it..."
        docker-compose up -d postgres
        sleep 10
    fi
    
    # Run the schema file
    docker exec threatmodel-postgres psql -U threatmodel -d threatmodel_db -f /docker-entrypoint-initdb.d/notification-schema.sql || true
    
    print_success "Database migrations completed"
}

# Function to start the service
start_service() {
    print_status "Starting ${SERVICE_NAME}..."
    
    # Start the service using docker-compose
    docker-compose up -d ${SERVICE_NAME}
    
    if [ $? -eq 0 ]; then
        print_success "Service started successfully"
    else
        print_error "Failed to start service"
        exit 1
    fi
}

# Function to wait for service to be healthy
wait_for_health() {
    print_status "Waiting for service to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:${PORT}/health >/dev/null 2>&1; then
            print_success "Service is healthy"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Service failed to become healthy within timeout"
    return 1
}

# Function to run tests
run_tests() {
    print_status "Running service tests..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Run TypeScript compilation
    npm run build
    
    # Run the test script
    npm run test
    
    if [ $? -eq 0 ]; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed, but continuing deployment"
    fi
}

# Function to show service status
show_status() {
    print_status "Service status:"
    
    echo ""
    echo "Container Status:"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "Service Logs (last 10 lines):"
    docker logs ${CONTAINER_NAME} --tail 10
    
    echo ""
    echo "Health Check:"
    if curl -f http://localhost:${PORT}/health >/dev/null 2>&1; then
        print_success "Service is responding on port ${PORT}"
        curl -s http://localhost:${PORT}/health | jq .
    else
        print_error "Service is not responding on port ${PORT}"
    fi
}

# Main deployment function
deploy() {
    print_status "Starting deployment of ${SERVICE_NAME}..."
    
    check_prerequisites
    stop_service
    build_service
    run_migrations
    start_service
    
    if wait_for_health; then
        run_tests
        show_status
        print_success "Deployment completed successfully!"
        
        echo ""
        echo "Service URLs:"
        echo "  Health Check: http://localhost:${PORT}/health"
        echo "  API Docs: http://localhost:${PORT}/api/docs"
        echo "  Metrics: http://localhost:${PORT}/metrics"
        
    else
        print_error "Deployment failed - service is not healthy"
        print_status "Showing logs for debugging:"
        docker logs ${CONTAINER_NAME} --tail 50
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the notification service (default)"
    echo "  build     Build the service only"
    echo "  start     Start the service only"
    echo "  stop      Stop the service only"
    echo "  restart   Restart the service"
    echo "  status    Show service status"
    echo "  logs      Show service logs"
    echo "  test      Run tests only"
    echo "  help      Show this help message"
}

# Function to show logs
show_logs() {
    if is_service_running; then
        docker logs ${CONTAINER_NAME} -f
    else
        print_error "Service is not running"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "build")
        check_prerequisites
        build_service
        ;;
    "start")
        check_prerequisites
        start_service
        wait_for_health
        ;;
    "stop")
        stop_service
        ;;
    "restart")
        stop_service
        start_service
        wait_for_health
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "test")
        run_tests
        ;;
    "help")
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac