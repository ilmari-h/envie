> *NOTE*: only users that have been given the *write* permission to the environment can update it.
> Read about [Access control](/guide/environments/access-control) to learn more.

You can set the value of a variable in your environment with the following command:

```bash
# Set a literal value
envie set <organization>:<project>:<environment-name> KEY=value
```

You can also clone values from another environment using the `--from` flag:

```bash
# Clone a key from another environment (same key name)
envie set <organization>:<project>:<environment-name> KEY --from org:project:other-env

# Clone and remap (copy SOURCE_KEY from other-env as KEY)
envie set <organization>:<project>:<environment-name> KEY=SOURCE_KEY --from org:project:other-env

# Clone multiple keys at once
envie set <organization>:<project>:<environment-name> API_KEY DB_URL SECRET --from org:project:staging

# Mix cloning and remapping in one command
envie set <organization>:<project>:<environment-name> PUBLIC_KEY=PRIVATE_KEY API_SECRET=API_KEY --from org:project:prod
```

To remove an environment variable, run:
```bash
envie unset <org>:<project>:<env-name> KEY
```

Every time you update an environment a new version of the environment is created so that version history is preserved.