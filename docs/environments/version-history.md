### Environment versions and rolling back

When ever you update an environment a new version is created. You can see your environment version history, including which user did the change, by running:

```bash
envie environment <organization>:<project>:<environment-name> audit
```

If you want to restore an existing environment version, you can run:

```bash
envie environment rollback <organization>:<project>:<environment-name> <version-number>
```

This creates a new version of the environment with the content of the given previous version.

