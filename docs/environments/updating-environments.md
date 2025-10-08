### Updating an environment

> *NOTE*: only users that have been given the *write* permission to the environment can update it

You can set the value of a variable in your environment with the following command:

```bash
envie set <organization>:<project>:<environment-name> KEY=value

# or
envie set <organization>:<project>:<environment-name> KEY value
```

You can also copy an existing value from another environment by providing the other environment's path as the second argument:

```bash
envie set <organization>:<project>:<environment-name> KEY org:project:other-env
```

To remove an environment variable, run:
```bash
envie unset <org>:<project>:<env-name> KEY
```

Every time you update an environment a new version of the environment is created so that version history is preserved.