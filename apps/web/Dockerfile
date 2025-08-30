# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace configuration and lockfile first
COPY package.json bun.lock turbo.json ./

# Copy all workspace source code
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install bun for workspace management
RUN npm install -g bun

# Install dependencies from workspace root
RUN bun install --frozen-lockfile

# Build the web app and its dependencies using Turbo
ENV SKIP_ENV_VALIDATION=1
RUN bunx turbo build --filter=web

# Production stage
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create nodejs group and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 300

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Use dumb-init and start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
