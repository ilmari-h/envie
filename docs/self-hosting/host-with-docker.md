> Having trouble with setup? Don't hesitate to reach out for support via email: <support@envie.cloud>

Envie is available on Docker hub as a docker image. To self-host, you need these two images:

- [envie-api](https://hub.docker.com/r/salhdev/envie-api)
- [envie-web](https://hub.docker.com/r/salhdev/envie-web)

Other prerequisites:
- A PostgreSQL instance, versions 16.x or 17.x should be fine
- A Redis instance
- GitHub OAuth application (used for login)

To get started, pull the two docker images from the Docker Hub registry:

```bash
docker pull salhdev/envie-api:latest && \
docker pull salhdev/envie-web:latest
```

Next, start the containers.

To start the API, run:

```bash
docker run -p 3001:3001 \
-e JWT_SECRET=<your-secret> \
-e DATABASE_URL=<your-postgresql-url> \
-e REDIS_CONNECTION_STRING=<your-redis-connection> \ 
-e PORT=3001 \
-e GITHUB_CLIENT_ID=<client_id> \ 
-e GITHUB_CLIENT_SECRET=<client_secret> \ 
-e GITHUB_CALLBACK_URL="https://<your-domain>/auth/github/callback" \
salhdev/envie-api:latest
```

To learn how to configure a GitHub OAuth application, see: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app>

You can verify that your API is running by pinging the healthcheck endpoint:

```bash
curl http://localhost:3001/health
```

Then start the web Client:

```bash
docker run -p 80:3000 \
-e NEXT_PUBLIC_API_URL=<your-api-url> \
-e API_URL=<your-api-url> \
-e JWT_SECRET=<same-as-api> \
-e DATABASE_URL=<same-as-api> \
salhdev/envie-web:latest
```

Once it's running, you should be able to open it in your browser at <http://localhost:80>.
