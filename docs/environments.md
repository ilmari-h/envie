With Envie, you can store your environment variables, API keys, database credentials and other application secrets in *environments*. 

You can have different environments under the same project.
For example, one called `prod` that you use when deploying to production, `staging` for staging and one called `dev-josh` for the personal dev environment of a developer called Josh.
All these environments can have different access control rules (more on that later).

### Creating an environment

You can create an environment with the command:

```bash
envie environment create <organization>:<project>:<environment-name> KEY1=VALUE1 KEY2=VALUE2
```

You can also create it from an existing `.env` file with the following command

```bash
envie environment create <organization>:<project>:<environment-name> ./path/to/.env
```

### Updating an environment

You can set the value of a variable in your environment with the following command:

```bash
envie set <organization>:<project>:<environment-name> KEY=value

# or
envie set <organization>:<project>:<environment-name> KEY value
```

You can also copy an existing value from another environment:

```
envie set <organization>:<project>:<environment-name> KEY org:project:other-env
```

To remove an environment variable, run:
```bash
envie unset <org>:<project>:<env-name> KEY
```

### Environment versions and rolling back

When ever you update an environment a new version is created. You can see your environment version history, including which user did the change, by running:

```bas
envie environment <organization>:<project>:<environment-name> audit
```

If you want to restore an existing environment version, you can run:

```bash
envie environment rollback <organization>:<project>:<environment-name> <version-number>
```

This creates a new version of the environment with the content of the given previous version.


### Using your environments

You can run a command with the given environment's variables with:

```bash
envie exec <organization>:<project>:<environment-name> ./your-command.sh

# or specify a version
envie exec <organization>:<project>:<environment-name>@version ./your-command.sh

# or no command to run an interactive shell
envie exec <organization>:<project>:<environment-name>

# use -- to pass arguments to the command
envie exec <organization>:<project>:<environment-name>@version npm -- run dev
```

### Different dev environments for different developers with a .envie file

When you have multiple developers working on the same project, each one of them can specify their own environment using a `.envie` file.

Place the `.envie` file at the root of your project and add it to your `.gitignore`

Inside the file specify your dev environment e.g. `organization:project:staging`.

Now when using `envie exec` with `default` argument for the environment e.g. `envie exec default ./some-command.sh`

Envie will read the environment name from the developer-specific `.envie` file.

### Example with package.json

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
    "build": "npx with-env next build",
    "dev": "npx with-env next dev --turbo",
    "start": "npx with-env next start",
    "with-env": "envie exec default --"
  },
  "dependencies": {
    /*...*/
  }
}
```

Now when running e.g. `npm run dev` the command will run with your specified environment.