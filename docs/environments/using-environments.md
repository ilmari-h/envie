### Using your environments

Envie allows you to use your environments via the `exec` command.
`exec` opens a new shell with your environment variables loaded and executes the command given as the second argument.

```bash
envie exec <organization>:<project>:<environment-name> ./your-command.sh

# or specify a version
envie exec <organization>:<project>:<environment-name>@version ./your-command.sh

# or no command to run an interactive shell
envie exec <organization>:<project>:<environment-name>

# use -- to pass arguments to the command
envie exec <organization>:<project>:<environment-name>@version npm -- run dev
```

