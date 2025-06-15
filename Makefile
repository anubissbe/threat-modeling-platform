# Threat Modeling Application Makefile

.PHONY: help setup build up down restart logs clean test lint

# Default target
help:
	@echo "Threat Modeling Platform - Development Commands"
	@echo "=============================================="
	@echo "make setup     - Initial project setup"
	@echo "make build     - Build all Docker images"
	@echo "make up        - Start all services"
	@echo "make down      - Stop all services"
	@echo "make restart   - Restart all services"
	@echo "make logs      - View logs (use service=<name> for specific service)"
	@echo "make clean     - Clean up volumes and images"
	@echo "make test      - Run all tests"
	@echo "make lint      - Run linters"
	@echo "make db-reset  - Reset database"
	@echo "make dev       - Start in development mode"

# Setup project
setup:
	@echo "Setting up Threat Modeling Platform..."
	@cp .env.example .env
	@echo "✓ Created .env file"
	@mkdir -p backend/services/{auth,core,ai,diagram,reporting}/src
	@mkdir -p backend/gateway/src
	@mkdir -p frontend/src/{components,pages,services,utils}
	@mkdir -p infrastructure/nginx
	@echo "✓ Created directory structure"
	@echo ""
	@echo "Next steps:"
	@echo "1. Update .env with your configuration"
	@echo "2. Run 'make build' to build Docker images"
	@echo "3. Run 'make up' to start services"

# Build Docker images
build:
	docker-compose build --parallel

# Start services
up:
	docker-compose up -d
	@echo "Services starting..."
	@echo "API Gateway: http://localhost:3000"
	@echo "Frontend: http://localhost:3006"
	@echo "RabbitMQ Management: http://localhost:15672"
	@echo "MinIO Console: http://localhost:9001"
	@echo "Adminer: http://localhost:8080"
	@echo "Grafana: http://localhost:3007"
	@echo "Prometheus: http://localhost:9090"

# Stop services
down:
	docker-compose down

# Restart services
restart:
	docker-compose restart

# View logs
logs:
ifdef service
	docker-compose logs -f $(service)
else
	docker-compose logs -f
endif

# Clean up
clean:
	docker-compose down -v
	docker system prune -f

# Reset database
db-reset:
	docker-compose exec postgres psql -U threatmodel -d threatmodel_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker-compose exec postgres psql -U threatmodel -d threatmodel_db -f /docker-entrypoint-initdb.d/01-schema.sql
	@echo "Database reset complete"

# Run tests
test:
	@echo "Running backend tests..."
	docker-compose exec auth-service npm test
	docker-compose exec core-service npm test
	docker-compose exec diagram-service npm test
	docker-compose exec report-service npm test
	docker-compose exec gateway npm test
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test

# Run linters
lint:
	@echo "Running ESLint..."
	docker-compose exec auth-service npm run lint
	docker-compose exec core-service npm run lint
	docker-compose exec diagram-service npm run lint
	docker-compose exec report-service npm run lint
	docker-compose exec gateway npm run lint
	docker-compose exec frontend npm run lint
	@echo "Running Python linters..."
	docker-compose exec ai-service python -m flake8
	docker-compose exec ai-service python -m black . --check

# Development mode with hot reload
dev:
	docker-compose up

# Service-specific commands
auth-shell:
	docker-compose exec auth-service sh

core-shell:
	docker-compose exec core-service sh

ai-shell:
	docker-compose exec ai-service bash

db-shell:
	docker-compose exec postgres psql -U threatmodel -d threatmodel_db

redis-cli:
	docker-compose exec redis redis-cli -a $${REDIS_PASSWORD:-redis123}

# MinIO setup
minio-setup:
	@echo "Creating MinIO buckets..."
	docker-compose exec minio mc alias set myminio http://localhost:9000 $${MINIO_ROOT_USER:-minioadmin} $${MINIO_ROOT_PASSWORD:-minioadmin123}
	docker-compose exec minio mc mb myminio/diagrams
	docker-compose exec minio mc mb myminio/reports
	docker-compose exec minio mc mb myminio/attachments
	@echo "MinIO buckets created"

# Generate TypeScript types from GraphQL schema
generate-types:
	@echo "Generating TypeScript types..."
	cd backend/gateway && npm run generate:types
	cd frontend && npm run generate:types

# Database migrations
db-migrate:
	docker-compose exec core-service npm run migrate

db-migrate-create:
	docker-compose exec core-service npm run migrate:create $(name)

# Seed database with sample data
db-seed:
	docker-compose exec core-service npm run seed

# Production build
build-prod:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy to staging
deploy-staging:
	@echo "Deploying to staging..."
	./scripts/deploy-staging.sh

# Health check
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health | jq '.' || echo "API Gateway not responding"
	@curl -s http://localhost:3001/health | jq '.' || echo "Auth Service not responding"
	@curl -s http://localhost:3002/health | jq '.' || echo "Core Service not responding"
	@curl -s http://localhost:3003/health | jq '.' || echo "AI Service not responding"
	@curl -s http://localhost:3004/health | jq '.' || echo "Diagram Service not responding"
	@curl -s http://localhost:3005/health | jq '.' || echo "Report Service not responding"