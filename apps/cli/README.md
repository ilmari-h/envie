# Envie cli

This is a CLI program for managing environment secrets securely and conviniently.

Say bye to .env files.

### Usage:

#### Global flags:

- `--instance-url` - URL of the server to connect to

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

##### TODO
- `envie shell <environment-path>` - Start a new shell with the given environment. This is the recommended way to inject your environment into a program runtime.
- CLI auth with access token env variable
- Make sure env access expiry works alright

#### Security TODOS:
- Add signatures and validate them
  - Both server and client check that the user who uploaded content also signed it