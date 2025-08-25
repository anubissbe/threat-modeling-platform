# Use Node.js 18 Alpine
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source and config files
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership and switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3010

CMD ["node", "dist/index.js"]