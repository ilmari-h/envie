You can create a a workspace specific configuration for Envie by adding an `envierc.json` file inside your git directory.

Example of an envierc.json:

```json
{
  "organizationName": "acme",
  "projectName": "acme-web-application",
  "instanceUrl": "https://api.envie.cloud"
}
```

When running commands inside a directory with an envierc.json file, like `envie exec`, you don't need to specify the full path to the environment.
E.g. instead of running:

```bash
envie exec acme:acme-web-application:dev
``` 

you can run:

```bash
envie exec dev
``` 

