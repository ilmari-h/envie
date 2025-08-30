# Build stage
FROM oven/bun:1.2.11-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace configuration and lockfile first
COPY package.json bun.lock ./

# Copy all workspace source code
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies from workspace root
RUN bun install --frozen-lockfile

# Build the API
RUN cd apps/api && bun run build

# Production stage
FROM oven/bun:1.2.11-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create nodejs group
RUN addgroup -g 1001 -S nodejs || true

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=bun:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=bun:nodejs /app/apps/api/package.json ./package.json

# Copy workspace dependencies that are needed at runtime
COPY --from=builder --chown=bun:nodejs /app/packages ./packages
COPY --from=builder --chown=bun:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER bun

# Expose port
EXPOSE 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init and start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "dist/index.js"]
