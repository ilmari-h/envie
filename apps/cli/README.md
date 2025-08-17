# Envie cli

This is a CLI program for managing environment secrets securely and conviniently.

Say bye to .env files.

### Configuration

#### Environment variables:
- `ENVIE_CONFIG_DIRECTORY` - Config file directory location.
- `ENVIE_KEYPAIR_PATH` - Specify Ed25519 keypair path (OpenSSH format) overriding the one in your config file.
- `ENVIE_INSTANCE_URL` - Specify instance url overriding the one in your config file.
- `ENVIE_ACCESS_TOKEN` - Specify the value of your access token to authenticate with the instance (alternative to CLI login)

### Usage:

#### Global flags:

- `--verbose` - Verbose output
G
#### Commands
- `envie config keypair <keypair-path>` - Set your keypair path
- `envie config instance-url <instance-url>` - Set your instance url
- `envie login` - Start browser login flow
- `envie organization list` - List organizations you have access to (have some role in them)
- `envie organization create <name> [--description/-d]` - Create a new organization
- `envie project list [--organization/-o <organzation>]` - List projects optionally filter by some organization (name or ID)
- `envie project create <organization-name:project-name> [--description/-d]` - Create a new project
- `envie environment create <organization-name:project-name:env-name> [file]` - Create a new environment
- `envie set <path> <key=value>` - Set an environment variable in the given environment
- `envie unset <path> <key=value>` - Unset an environment variable in the given environment
- `envie environment list <path>` - List environments, optionally filtering by path (path format name of organization e.g `my_organization` or project `my_organization:my_project`)
- `envie load <path> [--decrypt/-d]` - Load an environment and print to stdout

#### Access Tokens

Users can create access tokens to allow programmatic log-in from e.g. a VPS, Docker image, etc.

Access tokens inherit the user's organization role, but environment access must be explicitly granted.

##### TODO
- [x] Testing auth with access tokens
- [x] Updating env access for access key with `--write` does not update the entry but creates a new one
- [x] When ever user updates environment, make sure to sign the payload and on server validate that user is the owner of their keypair
  - [x] Rewrite pubkey logic - store Ed22519 keys on server instead of X22519
- [ ] `envie shell <environment-path> <command>` - Start a new shell with the given environment. This is the recommended way to inject your environment into a program runtime.
- [ ] Make sure env access expiry works alright for also user's not just access tokens
- [x] Workspace specific files to specify environment and instance (envierc.json)
  - Allows environment commands without specifying the full path
