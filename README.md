# Envie

A secure environment variable management system designed to replace `.env` files.

## Overview

Envie provides a complete platform for managing environment variables across teams and projects with:

- **Always encrypted** - Environment variables are encrypted before transit and never visible to the server
- **Fine-grained access control** - Grant access to specific environments on a per-user basis, optionally with time limits
- **Multi-tenant organizations** - Support for teams with role-based permissions
- **Version history** - Track changes to environment configurations over time. Rollback to previous and see an audit trail of changes

## Installation

Envie is available as a CLI tool on npm.

To install it globally on your machine, run:

```
$ npm install -g @envie/cli
```

## Usage

Once installed, run the command `envie` without arguments to bring up a setup wizard.
This wizard will help you with the initial configuration.

To start managing your environments, run `envie login`

For more help, run `envie -h` or for command specific instructions run `envie <command> -h`

### Workspace configurations with `envierc.json`

You can create a project specific configuration for Envie by adding an `envierc.json` file inside your project directory.

Example of an `envierc.json`
```json
{
  "organizationName": "acme",
  "projectName": "acme-web-application",
  "instanceUrl": "https://envie.acme.co"
}
```

When running commands inside a directory with an `envierc.json` file, like `envie exec`, you don't need to specify the full path to the environment (e.g. instead of _acme:acme-web-application:dev_ you can just specify _dev_).

## Configuration

Envie configuration can be managed via the CLI (see `envie config` subcommands).

Local configuration can also be managed via a `config.json` file, stored under the standard configuration directory if your operating system (`XDG_CONFIG_HOME/envie` for Linux and `~/Library/Application Support/envie` for macOS.) You can override this with the environment variable `ENVIE_CONFIG_DIRECTORY`.

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
- **Time-limited access** - Automatically revoke access after a given period of time

### Public Key Encryption
- **Privacy by design** - Your secrets are encrypted before they leave your computer
- **Selective sharing** - Only decrypt data for users you specifically authorize
- **No server access** - Even if the server is compromised, your environment variables remain secure

## Architecture

This is a TypeScript monorepo built with Turborepo containing:

### Applications
- **API Server** (`apps/api/`) - Express.js REST API with JWT authentication
- **CLI Tool** (`apps/cli/`) - Command-line interface for managing environments
- **Web Interface** (`apps/web/`) - Web UI


## Development prerequisites
- Bun >= 1.2.11
- PostgreSQL database
- Redis instance
- GitHub OAuth application
