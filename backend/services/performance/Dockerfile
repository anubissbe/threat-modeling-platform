# World-Class Performance Optimization Service Dockerfile

FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S performance -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=performance:nodejs /app/dist ./dist
COPY --from=builder --chown=performance:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=performance:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown performance:nodejs /app/logs

# Switch to non-root user
USER performance

# Expose port
EXPOSE 3018

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3018/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]