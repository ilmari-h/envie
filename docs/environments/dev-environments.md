### Different environments for different developers with a .envie file

When you have multiple developers working on the same project, each one of them can specify their own development environment using a `.envie` file.

Place the `.envie` file at the root of your project and add it to your `.gitignore`

Inside the file specify your dev environment e.g. `organization:project:staging`.

Now when using `envie exec` with `default` argument for the environment e.g. `envie exec default ./some-command.sh`

Envie will read the environment name from the developer-specific `.envie` file.

### Example: using Envie in a web development project repository

You can easily integrate envie with any development setup.
For example, here's how to use envie in a web development project together with scripts in your `package.json` file.

1. Create an `envierc.json` file in your project root (for more about `envierc.json`, see [Workspace configuration](https://web.envie.cloud/guide/configuration/workspaces))

2. Specify your personal default dev environment in `.envie` file.

3. Prefix your `package.json` development scripts with `envie exec` like so:

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "npx with-env next dev",
    "other-dev-command": "npx with-env some-script",
    "with-env": "envie exec default --"
  },
  "dependencies": {
    /*...*/
  }
}
```

Now when running e.g. `npm run dev` the example Next.js project will run with your specified environment.