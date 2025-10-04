The recommended way to use Envie in production is with access token authentication. Access tokens allow you to run CLI commands without requiring you to complete browser login. This makes it easy to use Envie programmatically e.g. from a Dockerfile or some other deployment script.

### Creating and using access tokens

Create an access token with the following command:

```bash
envie access-token create <name> --expiry <1h/1d/etc>
```

Be sure to copy the displayed value and store it somewhere safe, as it will not be shown again.

In order to use the access token with a given environment, you must explicitly give it access:

```bash
envie environment set-access <environment-path> <access-token-name>
```

Now, you can use the access token by setting the environment variable `ENVIE_ACCESS_TOKEN` to the value of your token. For example, you can pass this enviromment value to the `docker run` command and use envie in your Dockerfile:

```Dockerfile
CMD ["envie", "exec", "organization:project:environment", "my-program.sh"]
```
