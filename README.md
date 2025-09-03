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

**Requirements to use**:
- Node.js installed on your computer (v22.0 or newer)
- Linux or macOS operating system
- Ed25519 keypair (Envie uses Public Key Encryption and a Diffie-Hellman style protocol to secure your environments)

When using Envie for the first time, run the command `envie` without arguments to bring up a setup wizard.
This wizard will help you with the initial configuration.

To start managing your environments, run `envie login`

For more help, run `envie -h` or for command specific instructions run `envie <command> -h`

### Basic commands

For a comprehensive list run `envie -h`.

#### Migrating from `.env` files to Envie

Still using `.env` files? You can move them to Envie with the following commands.

Create a new environment from a .env file:
```bash
envie environment create org:project:env-name .env
```

Update an existing environment from a .env file:
```bash
envie environment update org:project:env-name .env
```

#### Updating your environments

Set a single environment variable:
```bash
envie set org:project:env-name KEY=value
# or
envie set org:project:env-name KEY value
# or copy from another environment
envie set org:project:env-name KEY org:project:other-env
```

Remove an environment variable:
```bash
envie unset org:project:env-name KEY
```

#### Running commands with environment variables

Execute a command with environment variables loaded:
```bash
envie exec org:project:env-name@version your-command
```

Start an interactive shell with environment variables:
```bash
envie exec org:project:env-name@version
```

Run a command with arguments (use `--` to separate):
```bash
envie exec org:project:env-name@version npm -- run dev
```

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

### Different dev environments for different developers with a `.envie` file

When you have multiple developers working on the same project, each one of them can specify their own environment using a `.envie` file.

Place the `.envie` file at the root of your project and add it to your `.gitignore`

Inside the file specify your dev environment e.g. `acme-corp:project-name:joshs-dev-env`.

Now when using `envie exec` with `default` argument for the environment e.g. `envie exec default ./some-command.sh`

Envie will read the environment name from the developer-specific `.envie` file.

### Example configuration with `package.json`

You can easily integrate envie with any development setup.
For example, here's how to use envie in a web development project together with scripts in your `package.json` file.

1. Create an `envierc.json` file in your project root

2. Specify your personal default dev environment in `.envie` file.

3. Prefix your `package.json` development scripts with `envie exec` like so:

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun with-env next build",
    "dev": "bun with-env next dev --turbo",
    "start": "bun with-env next start",
    "with-env": "envie exec default --"
  },
  "dependencies": {
    /*...*/
  }
}
```

Now when running e.g. `npm run dev` the command will run with your specified environment.

## Configuration

Envie configuration can be managed via the CLI (see `envie config` subcommands).

Local configuration can also be managed via a `config.json` file, stored under the standard configuration directory if your operating system (`XDG_CONFIG_HOME/envie` for Linux and `~/Library/Application Support/envie` for macOS.) You can override this with the environment variable `ENVIE_CONFIG_DIRECTORY`.

## Self Hosting

Envie can be self-hosted using Docker. Two images are required:

- **API**: [salhdev/envie-api](https://hub.docker.com/r/salhdev/envie-api)
- **Web client**: [salhdev/envie-web](https://hub.docker.com/r/salhdev/envie-web)

Image usage documented on Docker hub.

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
