# Multi-stage build for file service
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    vips-dev \
    build-base \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
EXPOSE 3009
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache \
    dumb-init \
    vips

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fileservice -u 1001

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build --chown=fileservice:nodejs /app/dist ./dist

# Create storage directories
RUN mkdir -p /app/uploads /app/temp /app/logs && \
    chown -R fileservice:nodejs /app/uploads /app/temp /app/logs

# Switch to non-root user
USER fileservice

# Expose port
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Start application
CMD ["dumb-init", "node", "dist/server.js"]