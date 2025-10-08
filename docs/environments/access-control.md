In order for other users to see or edit an environment you created, you must explicitly grant them access via `environment set-access`:

```bash
envie environment set-access <environment-path> <user-or-token>
```

You can optionally give them access only for a limited time with the `--expiry` flag.

Pass in the `--write` flag if you want the user to be able to edit the environment.

Any users you invite must also belong to the organization that the environment's project is in.
For more about that, see [Organization roles](https://web.envie.cloud/guide/organizations).