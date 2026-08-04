# Self-Hosting

> **Status:** PUBLISHED
> **Last updated:** 2026-05-03
> **Applies to:** Community Self-Deploy

## What it does

Shows the current self-host evaluation paths for img-man using either a one-command Docker image with embedded MongoDB or Docker Compose with a separate MongoDB service.

## When to use it

- You want the fastest no-config evaluation path with `docker run`.
- You want to evaluate img-man locally on your laptop.
- You want a repeatable Docker-based setup for a dev VM or test server.
- You want to generate a local env file instead of hand-writing auth secrets.

## Step-by-step

1. **Start Docker** — make sure Docker Desktop or the Docker engine is running before you start img-man.
2. **Fastest path: run the published image** — run `docker run --rm -p 3000:3000 imageman/imageman:latest`.
3. **Open ImageMan** — visit `http://localhost:3000`.
4. **Check health** — use `http://localhost:3000/api/health/live` for liveness and `http://localhost:3000/api/health/ready` for readiness.
5. **If you want stable local secrets or custom env vars, use Docker Compose instead** — run `node --experimental-strip-types scripts/self-host-bootstrap.ts --file .env.self-host`, then `docker compose --env-file .env.self-host up --build`.
6. **Stop the stack** — stop the container with `Ctrl+C` for `docker run`, or `docker compose down -v --remove-orphans` for the Compose path.

## Tips & limits

- The fastest evaluation path is `docker run --rm -p 3000:3000 imageman/imageman:latest`.
- The single-container image auto-generates ephemeral `NEXTAUTH_SECRET` and `GCP_CREDENTIALS_ENCRYPTION_KEY` on first boot if you do not provide them.
- Because those values are ephemeral by default, stored credentials and sessions are not meant to survive a throwaway `docker run` restart unless you pass stable secrets explicitly.
- The Docker Compose path is still the better fit when you want persistent local settings and a named MongoDB volume.
- The compose file starts img-man plus MongoDB 8 with a named Docker volume for persistent local data.
- No secret file is required for local boot, but a generated env file gives you stable secrets across restarts.
- If you change the published port for `docker run`, also set `NEXTAUTH_URL`, for example: `docker run --rm -p 3001:3000 -e NEXTAUTH_URL=http://localhost:3001 imageman/imageman:latest`.
- Storage-backed asset uploads/downloads are not automatic in a fresh self-host env file: set `GCP_PROJECT_ID`, `GCP_STORAGE_BUCKET`, and `GCP_APP_CREDENTIALS_PATH`, or connect a BYOC bucket in the dashboard before testing upload flows.
- Google and GitHub sign-in buttons only appear when those provider credentials are configured.
- The single-container image is for evaluation and light self-host trials, not for production hosting.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `docker run` exits immediately | Docker could not start the embedded MongoDB or the container could not bind the requested port. | Run `docker logs <container>` and retry with a free host port. |
| `docker compose` cannot connect to Docker | Docker Desktop / engine is not running. | Start Docker and rerun the command. |
| `/api/health/ready` returns `503` | img-man cannot reach MongoDB or storage readiness fails (bucket/credentials). | Check container logs for `prompt`, verify `MONGODB_URI`, and validate `GCP_PROJECT_ID`, `GCP_STORAGE_BUCKET`, and service-account credentials. Set `HEALTHCHECK_REQUIRE_STORAGE=0` only if you intentionally want DB-only readiness. |
| Port `3000` is already in use | Another local service is already bound to that port. | Start with `IMAGEMAN_PORT=3001` and set `NEXTAUTH_URL=http://localhost:3001`. |
| Google or GitHub buttons are missing | Those OAuth providers are not configured. | Use email/password auth or add the provider env vars in your env file. |

## Related

- [configuration.md](configuration.md)
- [getting-started.md](getting-started.md)
- [faq.md](faq.md#self-hosting)