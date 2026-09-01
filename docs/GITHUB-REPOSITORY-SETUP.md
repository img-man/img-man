# GitHub Repository Setup (manual, one-time)

Values that cannot be set from repository files. A maintainer with org
admin applies these in the GitHub UI.

## Description

```
Open-source, self-hosted media platform with DAM, image delivery, design tools, PDF, AI, and APIs.
```

## Topics

```
asset-management
digital-asset-management
dam
image-management
image-cdn
media-management
self-hosted
open-source
nextjs
typescript
react
mongodb
image-processing
ai
pdf
docker
api
mcp
```

## Social preview

Use a 1280×640 PNG with the img-man wordmark over the dashboard preview
(`public/screenshots/dashboard.svg` rendered to PNG). Note: the wordmark
and logo are trademarked — see `TRADEMARK.md`.

## Settings checklist

| Setting | Value | Where |
| --- | --- | --- |
| Default branch | `main` | Settings → Branches |
| Allowed merge methods | Squash + merge commit only (no rebase noise on tags) | Settings → General |
| Branch protection | Per [REPOSITORY-MAINTENANCE.md](REPOSITORY-MAINTENANCE.md) | Settings → Branches |
| Private vulnerability reporting | Enabled | Settings → Security → Code security and analysis |
| Secret scanning + push protection | Enabled (free for public repos) | Settings → Code security |
| Actions → Workflow permissions | Read repository contents and packages | Settings → Actions → General |
| Wiki / Issues | Issues on; Wiki off (docs live in `customer-docs/`) | Settings → General |
| Docker Hub `img-man` repo | Created public, matching `DOCKERHUB_USERNAME` | hub.docker.com |
| Actions secret `DOCKERHUB_TOKEN` | Docker Hub **access token** (not password) | Settings → Secrets and variables → Actions |
| Actions variable `DOCKERHUB_USERNAME` | Docker Hub user/org namespace | same |
| GHCR package visibility | Public after first release | Packages → img-man |
| `@img-man/maintainers` team | Create before merge-gating; CODEOWNERS references it | Org → Teams |

**Manual dependency:** existence of `@img-man/maintainers` could not be
verified from outside the org. Until an admin confirms the team exists and
has members, do **not** enable "Require review from Code Owners" in branch
protection — GitHub would treat the CODEOWNERS entries as no-owner paths
and PRs could stall waiting for an approval nobody can give. Plain
required-approver counts work without the team. See
[REPOSITORY-MAINTENANCE.md](REPOSITORY-MAINTENANCE.md).

## What must NOT be configured

- No paid GitHub Advanced Security features are required by any workflow.
- No webhook to a hosted/cloud service; the repository must work with
  GitHub Actions + public registries only.
- No secrets committed anywhere — CI's gitleaks job enforces this.
