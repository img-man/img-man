# Releases

How img-man versions, builds, and publishes. The automation lives in
`.github/workflows/release.yml`; this document explains it and the manual
one-time setup it depends on.

## Versioning policy

SemVer: `MAJOR.MINOR.PATCH`

| Bump | Meaning |
| --- | --- |
| PATCH (`v0.1.1`) | Bug fixes only, no API/behavior breaks |
| MINOR (`v0.2.0`) | Backwards-compatible functionality |
| MAJOR (`v1.0.0`) | Breaking changes (API contracts, config, upgrade path) |

- Git tags are the release source of truth: `vX.Y.Z`.
- `v1.0.0` is not claimed until the maintainers decide the API surface is
  frozen. The project is currently `0.x`.
- The `latest` image tag always points at the newest **stable** release —
  never at `main` commits. No `edge` tag is published in this phase.

## Tag → artifact correspondence

For tag `v1.4.2` the pipeline publishes:

- GitHub Release `v1.4.2` (with the CycloneDX SBOM attached)
- Docker Hub `<DOCKERHUB_USERNAME>/img-man:1.4.2`, `:1.4`, `:1`, `:latest`
- GHCR `ghcr.io/img-man/img-man:1.4.2`, `:1.4`, `:1`, `:latest`

The workflow refuses to run unless the tag equals `version` in
`package.json`, so images and releases can't drift from source.

## How to create a release

1. Ensure `main` is green in CI.
2. Update `CHANGELOG.md`: move `## Unreleased` entries into a new
   `## [X.Y.Z] - YYYY-MM-DD` section.
3. Bump `version` in `package.json` (root). Commit, PR, merge.
4. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. `release.yml` runs: quality gates → image build → smoke test →
   vulnerability scan → publish → GitHub Release with notes.

Any failed stage (purity, SPDX, typecheck, tests, build, smoke, scan)
stops publication. A broken image is never published.

## CI checks before publication

From `release.yml`'s `quality` job, all blocking:

- `npm run verify:public-purity`
- `npm run verify:spdx`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`
- `npm run sbom` (artifact, then attached to the Release)

Note: `npm run lint` is advisory repo-wide until the pre-existing React
Compiler backlog is resolved (see `ci.yml` comments); it does not gate
releases either. Fix its backlog before making it a release gate.

## Container vulnerability scan policy

Trivy scans the built image before it is pushed:

- Fail the release only on **CRITICAL** findings that have a fix available
  (`--ignore-unfixed`).
- Unfixable transitive advisories are triaged like `npm audit` findings in
  CI: tracked, mitigated where possible, documented in `SECURITY.md`.
- Flip `ignore-unfixed: true` to `false` in `release.yml` once the
  dependency backlog is clean.

## Required one-time GitHub configuration (manual)

Settings → Secrets and variables → Actions:

| Name | Type | Purpose |
| --- | --- | --- |
| `DOCKERHUB_TOKEN` | **Secret** | Docker Hub access token (not the account password) |
| `DOCKERHUB_USERNAME` | Variable | Docker Hub user/org that owns the published repo |

- GHCR needs no secret — the workflow uses `GITHUB_TOKEN` with
  `packages: write`.
- If `DOCKERHUB_USERNAME` is unset, the release still publishes to GHCR
  and GitHub; Docker Hub steps are skipped. Docker Hub is therefore
  optional, GHCR is the default registry.
- Create the Docker Hub repository `img-man` under the chosen namespace
  before the first push (public).
- After the first GHCR publish, set the `img-man` package to **Public**
  in GitHub (Packages → img-man → Settings → Change visibility), or
  unauthenticated `docker pull ghcr.io/img-man/img-man` will fail.

## Docker Hub OIDC (future hardening)

Docker Hub supports OIDC passwordless publishing from GitHub Actions.
It is deliberately not required in this phase; the access-token route is
documented above and works for everyone. Revisit OIDC once the Docker Hub
organization supports it — then `DOCKERHUB_TOKEN` can be retired.

## Rollback

Release images are immutable per version tag. To roll a deployment back:

```bash
docker pull ghcr.io/img-man/img-man:<previous>
docker stop imageman && docker run -d ... ghcr.io/img-man/img-man:<previous>
```

Because there is no versioned DB migration system (see
[upgrading.md](upgrading.md)), verify `0.x` downgrades against a restored
backup first. For `1.x` and later, documented MINOR/MAJOR downgrades are
not guaranteed.

## Emergency release procedure

1. Fix on `main` via a fast-tracked PR (maintainer approval still required).
2. Branch the tag from the fix commit: bump `package.json` patch version,
   tag `vX.Y.Z`, push the tag.
3. `release.yml` triggers on the tag only — there is no manual-dispatch
   path. If CI is red for unrelated reasons, fix or revert the blocker
   first; do not bypass gates. A bypassed gate is a published broken image.
4. Announce in the GitHub Release notes what changed and why.
