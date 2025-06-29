# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a secure environment variable management system built as a Turborepo monorepo. It features:
- End-to-end encrypted environment variables
- Multi-tenant organizations and projects
- User access control with asymmetric encryption
- Web interface and CLI tooling
- GitHub OAuth authentication

## Repository Structure

### Apps
- `apps/api/` - Express.js REST API server with JWT auth and GitHub OAuth
- `apps/web/` - Next.js frontend application with Tailwind CSS
- `apps/cli/` - Command-line interface tool
- `apps/codegen/` - OpenAPI code generation utilities

### Packages
- `packages/db/` - Drizzle ORM database layer with PostgreSQL
- `packages/rest/` - Shared type-safe API contracts using ts-rest
- `packages/ui/` - Shared React component library
- `packages/eslint-config/` - ESLint configurations
- `packages/typescript-config/` - TypeScript configurations

## Development Commands

**Root level commands (uses Turbo for orchestration):**
- `bun dev` - Start all apps in development mode
- `bun build` - Build all apps and packages
- `bun lint` - Run ESLint across all packages
- `bun check-types` - Run TypeScript type checking
- `bun format` - Format code with Prettier

**API-specific commands:**
- `cd apps/api && bun dev` - Start API server with hot reload
- `cd apps/api && bun build` - Build API for production
- `cd apps/api && bun start` - Start production API server

**Web app commands:**
- `cd apps/web && bun dev` - Start Next.js dev server on port 3000
- `cd apps/web && bun build` - Build Next.js app
- `cd apps/web && next start` - Start production Next.js server

**Database commands:**
- `cd packages/db && bun run db:generate` - Generate Drizzle migrations
- `cd packages/db && bun run db:migrate` - Run database migrations
- `cd packages/db && bun run db:push` - Push schema changes directly

## Architecture Notes

### Authentication & Security
- JWT tokens for API authentication via cookies or Bearer headers
- GitHub OAuth integration for user login
- Redis for CLI login token exchange
- Asymmetric encryption (likely ECIES) for environment variable security
- User access control with wrapped encryption keys

### Database Design
- PostgreSQL with Drizzle ORM
- Multi-tenant: Organizations → Projects → Environments → Environment Versions
- User permissions managed through organization roles and environment access
- Environment versions preserve history with configurable retention

### API Architecture
- Type-safe contracts using ts-rest library
- Express.js server with middleware-based auth
- RESTful endpoints for organizations, projects, environments
- Encrypted content stored as ciphertext with metadata

### Frontend
- Next.js 15 with React 19
- Tailwind CSS for styling
- TanStack Query for API state management
- TanStack Form for form handling
- Type-safe API client generated from shared contracts

### Key Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `GITHUB_CLIENT_ID/SECRET` - GitHub OAuth credentials
- `REDIS_CONNECTION_STRING` - Redis connection for CLI auth
- `API_URL/NEXT_PUBLIC_API_URL` - API server URLs
- `FRONTEND_URL` - Frontend URL for redirects

## Crypto Implementation Notes
- Environment variables are encrypted client-side before storage
- Each environment has wrapped AES keys for authorized users
- Asymmetric encryption uses ephemeral key pairs for key wrapping
- The current branch `asymmetric-enc` suggests active cryptographic development

## Package Manager
This project uses Bun (`bun@1.2.11`) as the package manager. Always use `bun` instead of npm/yarn for consistency.