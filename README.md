# Envie

A secure environment variable management system designed to replace `.env` files with a modern, encrypted solution.

## Overview

Envie provides a complete platform for managing environment variables across teams and projects with:

- **Always encrypted** - Environment variables are encrypted before transit and never visible to the server
- **Fine-grained access control** - Grant access to specific environments on a per-user basis
- **Multi-tenant organizations** - Support for teams with role-based permissions
- **Version history** - Track changes to environment configurations over time

## Architecture

This is a TypeScript monorepo built with Turborepo containing:

### Applications
- **API Server** (`apps/api/`) - Express.js REST API with JWT authentication
- **CLI Tool** (`apps/cli/`) - Command-line interface for managing environments
- **Web Interface** (`apps/web/`) - Web UI

## Security Practices

Envie uses public key encryption to ensure your environment variables stay private and secure:

### How It Works
- **Client-side encryption** - Your environment variables are encrypted on your device before being sent anywhere
- **Public key encryption** - Uses modern cryptography so only people you give access to can decrypt your data
- **Zero-knowledge server** - The server stores encrypted data but can never see your actual environment variables

### Access Control
- **Fine-grained permissions** - Grant access to individual environments, not just entire projects
- **Role-based access** - Organization admins can manage who can create projects and environments
- **Explicit access only** - Users must be explicitly granted access to each environment they need
- **Time-limited tokens** - API tokens can expire automatically for enhanced security

### Public Key Encryption
- **Privacy by design** - Your secrets are encrypted before they leave your computer
- **Selective sharing** - Only decrypt data for users you specifically authorize
- **No server access** - Even if the server is compromised, your environment variables remain encrypted

### Prerequisites
- Bun >= 1.2.11
- PostgreSQL database
- Redis instance (for CLI authentication)
- GitHub OAuth application

### Setup
```bash
# Install dependencies
bun install

# Set up environment variables (see apps/*/README.md for specifics)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run database migrations
cd packages/db && bun run db:migrate

# Start all services in development
bun dev
```

### Available Commands
```bash
# Development
bun dev                 # Start all apps in development mode
bun build              # Build all apps and packages
bun lint               # Run ESLint across all packages
bun check-types        # Run TypeScript type checking
bun format             # Format code with Prettier

# Database operations
cd packages/db && bun run db:generate  # Generate migrations
cd packages/db && bun run db:migrate   # Run migrations
cd packages/db && bun run db:push      # Push schema changes
```

## Usage

### CLI Tool
The CLI provides a complete interface for managing environments:

```bash
# Configuration
envie config keypair ~/.ssh/id_ed25519    # Set your Ed25519 keypair
envie config instance-url https://api.envie.dev
envie login                                # Authenticate via browser

# Organization management
envie organization list
envie organization create "My Team"

# Project management
envie project list --organization "My Team"
envie project create "My Team:my-app"

# Environment management
envie environment create "My Team:my-app:production"
envie set "My Team:my-app:production" DATABASE_URL=postgres://...
envie load "My Team:my-app:production"    # Load environment variables
```

### Web Interface
Access the web dashboard at your configured frontend URL to:
- Manage organizations and invite team members
- Create and configure projects
- Edit environment variables with a user-friendly interface
- Review environment version history
- Manage user access and permissions

## Project Structure

```
envie/
├── apps/
│   ├── api/           # REST API server
│   ├── web/           # Next.js web interface
│   ├── cli/           # Command-line tool
│   └── codegen/       # API specification generation
├── packages/
│   ├── db/            # Database schema and migrations
│   ├── rest/          # Type-safe API contracts
│   ├── ui/            # Shared React components
│   └── config/        # Shared configuration packages
└── README.md          # This file
```

## License

MIT License - see LICENSE file for details.