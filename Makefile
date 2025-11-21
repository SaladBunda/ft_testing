# Makefile for ft_transendance_42 project
# Docker Compose commands for managing microservices (auth-backend, usr-manag, frontend)

# Volumes :
VOLUMES_DIR=/home/${USER}/transendance_volumes
ENV_FILE=.env
users_db_dir=${VOLUMES_DIR}/users_db
auth-backend-node_modules_dir=${VOLUMES_DIR}/auth-backend-node_modules
usr-manag-node_modules_dir=${VOLUMES_DIR}/usr-manag-node_modules
frontend-node_modules_dir=${VOLUMES_DIR}/frontend-node_modules
db-init-node_modules_dir=${VOLUMES_DIR}/db-init-node_modules

.PHONY: help setup setup-full init build up down restart logs ps clean rebuild install-deps test smoke-test

# Default target
help:
	@echo "Available commands:"
	@echo "  setup       - Quick environment setup for development"
	@echo "  setup-full  - Interactive environment setup"
	@echo "  build       - Build all services"
	@echo "  up          - Start all services in detached mode"
	@echo "  down        - Stop and remove all services"
	@echo "  restart     - Restart all services"
	@echo "  logs        - Show logs from all services"
	@echo "  ps          - Show running containers"
	@echo "  clean       - Stop and remove all containers, networks, and volumes"
	@echo "  rebuild     - Clean and rebuild all services"
	@echo "  install-deps - Install dependencies (for local development)"
	@echo "  test        - Run smoke tests to verify endpoints"
	@echo "  init        - Complete setup (env + deps + build + start)"
	@echo "  dev         - Start all services and show logs"

${users_db_dir}:
	mkdir -p ${users_db_dir}

# Build commands
build: 
	docker compose build --no-cache

# Start commands
up: ${users_db_dir}
	docker compose up -d

# Stop commands
down:
	docker compose down

# Restart commands
restart:
	docker compose restart

# Log commands
logs:
	docker compose logs -f

# Status commands
ps:
	docker compose ps

# Clean commands
clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# Rebuild commands
rebuild: clean build up

# Development commands
install-deps:
	@echo "Installing auth-backend dependencies..."
	cd auth-backend && npm install
	@echo "Installing usr-manag dependencies..."
	cd usr-manag && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Smoke test commands
test:
	@echo "Running smoke tests..."
	@echo "Testing auth-backend health..."
	@curl -s http://localhost:8005/health > /dev/null && echo "✓ Auth-backend health endpoint working" || echo "✗ Auth-backend health endpoint failed"
	@echo "Testing usr-manag health..."
	@curl -s http://localhost:4000/health > /dev/null && echo "✓ Usr-manag health endpoint working" || echo "✗ Usr-manag health endpoint failed"
	@echo "Testing frontend..."
	@curl -s http://localhost:8080 > /dev/null && echo "✓ Frontend endpoint working" || echo "✗ Frontend endpoint failed"

# Complete setup commands
init: setup install-deps build up
	@echo "✅ Complete setup finished!"
	@echo "🚀 Access the application at: http://localhost:8080"

# Quick development commands
dev: up logs

# Database commands
db-backup:
	@echo "Backing up auth-backend database..."
	docker compose exec auth-backend sqlite3 /usr/src/app/db/sqlite.db ".backup /usr/src/app/db/backup_$(shell date +%Y%m%d_%H%M%S).db"
	@echo "Backing up usr-manag database..."
	docker compose exec usr-manag sqlite3 /usr/src/app/data/database.sqlite ".backup /usr/src/app/data/backup_$(shell date +%Y%m%d_%H%M%S).db"

# Service-specific commands
backend-shell:
	docker compose exec auth-backend /bin/bash

usr-manag-shell:
	docker compose exec usr-manag /bin/sh

frontend-shell:
	docker compose exec frontend /bin/sh

# Monitoring commands
stats:
	docker stats

# Environment commands
env:
	@echo "Auth-backend environment:"
	@docker compose exec auth-backend env | grep -E "(NODE_ENV|JWT|DB)" || echo "No environment variables found"
	@echo "Usr-manag environment:"
	@docker compose exec usr-manag env | grep -E "(NODE_ENV|AUTH_SERVICE_URL|DATABASE_PATH)" || echo "No environment variables found"
	@echo "Frontend environment:"
	@docker compose exec frontend env | grep -E "(NODE_ENV|API)" || echo "No environment variables found"