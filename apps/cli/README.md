# Envie cli

This is a CLI program for managing `.env` files securely and conviniently.

### Usage:

#### Global flags:

- `--instance-url` - URL of the server to connect to

#### Commands
- `envie config keypair <keypair-path>` - Set your keypair path
- `envie config instance-url <instance-url>` - Set your instance url
- `envie login` - Start browser login flow
- `envie organization list` - List organizations you have access to (have some role in them)
- `envie organization create` - Create a new organization
- `envie project list [--organization/-o <organzation>]` - List projects optionally filter by some organization (name or ID)
- `envie list <path>` - List environments, optionally filtering by path (path format name of organization e.g `my_organization` or project `my_organization:my_project`)