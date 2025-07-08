# Use Node.js 20 LTS Alpine image for smaller size and better security
FROM node:20-alpine AS base

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3009
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm install
COPY . .
# Skip TypeScript compilation for now
# RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    && addgroup -g 1001 -S nodejs \
    && adduser -S notification -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production && npm install ts-node typescript && npm cache clean --force

# Copy source application directly
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/tsconfig.runtime.json ./tsconfig.runtime.json

# Create logs directory
RUN mkdir -p logs && chown notification:nodejs logs

# Switch to non-root user
USER notification

# Expose port
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3009/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Production start command - use ts-node with transpile-only
CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]

# Labels for metadata
LABEL name="threat-modeling-notification-service" \
      version="1.0.0" \
      description="Notification service for threat modeling platform" \
      maintainer="Threat Modeling Platform Team"