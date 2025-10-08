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

### Viewing your environment

To see information about your environment, run:

```bash
envie environment show <organization>:<project>:<environment-name>
```

You should see output like:

```
╭─── your-environment (3 variables)
│ VAR1=<encrypted>
│ VAR2=<encrypted>
│ VAR3=<encrypted>
╰──────────────────────────────────
```

Variable values will show up as `<encrypted>` by default. If you want to see their values, you can pass the option `--unsafe-decrypt`. **NOTE**: Do not use this option in production! For the recommended way to use environments, see [Using environments](https://web.envie.cloud/guide/environments/using-environments).
