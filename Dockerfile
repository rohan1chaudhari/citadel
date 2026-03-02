# Multi-stage build for production
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY host/package*.json ./host/
COPY core/package*.json ./core/

# Install dependencies
RUN npm ci
RUN cd core && npm ci && cd ..
RUN cd host && npm ci && cd ..

# Copy source code
COPY . .

# Build packages
RUN cd core && npm run build && cd ..
RUN cd host && npm run build && cd ..

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create data and apps directories
RUN mkdir -p data apps

# Copy package files
COPY package*.json ./
COPY host/package*.json ./host/
COPY core/package*.json ./core/

# Install production dependencies only
RUN npm ci --omit=dev
RUN cd core && npm ci --omit=dev && cd ..
RUN cd host && npm ci --omit=dev && cd ..

# Copy built artifacts from builder
COPY --from=builder /app/core/dist ./core/dist
COPY --from=builder /app/host/.next ./host/.next
COPY --from=builder /app/host/public ./host/public
COPY --from=builder /app/host/next.config.* ./host/

# Copy CLI scripts
COPY scripts ./scripts

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Set environment
ENV NODE_ENV=production
ENV CITADEL_DATA_ROOT=/app/data
ENV CITADEL_APPS_DIR=/app/apps
ENV CITADEL_BACKUP_RETENTION=7
ENV CITADEL_BACKUP_INTERVAL_HOURS=24
ENV PORT=3000

# Start the server
CMD ["npm", "start", "--workspace=host"]
