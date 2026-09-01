# Upgrading

## Before you upgrade — always

1. **Back up MongoDB.** There is no versioned schema-migration runner;
   models are applied as the app reads/writes them, so a rollback to an
   older image can encounter newer-field documents it tolerates (usually)
   or misinterprets (rare, but possible in 0.x).
   ```bash
   mongodump --uri "$MONGODB_URI" --archive=imageman-pre-$(date +%F).archive
   ```
2. **Back up your encrypted credentials** — they live in MongoDB
   (`organizations.storageConfig`, `apiKey`, etc.), so the mongodump above
   covers them. Keep the `GCP_CREDENTIALS_ENCRYPTION_KEY` value — without
   it the stored credentials cannot be decrypted.
3. Read the release notes / `CHANGELOG.md` for the target version.

## From source

```bash
git fetch --tags
git checkout vX.Y.Z        # never track a moving branch in production
npm ci
npm run build
# restart your process manager (systemd/pm2/etc.)
```

Schema/behavior changes (if any) apply lazily on first read. Watch logs
after restart for `prompt:` fields from the health system.

## With Docker

Pin by tag, never `latest` in production if you want controlled rollouts:

```bash
docker pull ghcr.io/img-man/img-man:X.Y           # or the exact patch tag
docker stop imageman && docker rm imageman
docker run -d --name imageman ... ghcr.io/img-man/img-man:X.Y.Z
```

## With Docker Compose

```bash
docker compose pull app || docker compose build app   # published vs local build
docker compose up -d
docker compose ps                                      # health: healthy
curl -s localhost:3000/api/health/ready | jq
```

`docker compose down` keeps the `imageman-mongo-data` volume.
`down -v` **deletes your database** — only for disposable stacks.

## Configuration changes between versions

- Any new required env var is called out in release notes and added to
  `.env.example` in the same change. Diff `.env.example` against your
  deployed env file after each upgrade:
  ```bash
  git diff vOLD..vNEW -- .env.example
  ```
- Compose file changes: `git diff vOLD..vNEW -- docker-compose.yml`.

## Rollback

```bash
docker run -d --name imageman ... ghcr.io/img-man/img-man:<previous>
```

If the newer app already wrote data in an incompatible way (possible
while the project is 0.x), restore the mongodump taken above:

```bash
mongorestore --uri "$MONGODB_URI" --drop --archive=imageman-pre-<date>.archive
```

Stable 1.x policy: PATCH/MINOR downgrades are not guaranteed; MAJOR
upgrades will document a tested rollback path or explicitly say there
isn't one.

## Upgrade cadence

- **PATCH** — safe anytime, no expected downtime beyond container restart.
- **MINOR** — test against a staging copy of your database first if you
  depend on unusual features (AI providers, migrations, embed flows).
- **MAJOR** — read docs, expect configuration work, plan a maintenance
  window.
