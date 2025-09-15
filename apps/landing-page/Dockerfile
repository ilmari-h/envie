# Build stage
FROM node:24-alpine AS builder

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
RUN bunx turbo build --filter=landing-page

# Production stage
FROM node:24-alpine AS runner

RUN apk add --no-cache curl

# Create nodejs group and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing-page/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing-page/.next/static ./apps/landing-page/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing-page/public ./apps/landing-page/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3003

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/ || exit 1

# Set environment variables for server binding
ENV HOSTNAME="0.0.0.0"
ENV PORT=3003

CMD ["node", "apps/landing-page/server.js"]