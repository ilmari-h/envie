You can add new users to your organization by creating an invite link:

```bash
envie organization invite <organization-name> --expiry 1d --one-time
```

If you want to invite more people via the same link, skip the `--one-time` option.

The command prints out a link that you can share with your teammates.

Users that join via the link will have minimal permissions by default.
You can adjust permissions with `organization set-access`. For example:

```bash
envie organization set-access <organization-name> <user> \
--add-members=false \
--create-environments=true \
--create-projects=false \
--edit-project=true \
--edit-organization=false \
```

You must explicitly grant users access to environments. See [Environment access control](https://web.envie.cloud/guide/environments/access-control)