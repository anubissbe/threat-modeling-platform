FROM node:18-alpine AS builder

# Install Python and build dependencies for TensorFlow.js
RUN apk add --no-cache python3 make g++ py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies for TensorFlow.js
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy model and data directories (if they exist)
COPY --from=builder /app/models ./models 2>/dev/null || true
COPY --from=builder /app/data ./data 2>/dev/null || true

# Create directories for models and data
RUN mkdir -p models data

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/api/ai/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the service
CMD ["node", "dist/server.js"]