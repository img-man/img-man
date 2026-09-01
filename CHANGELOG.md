# Changelog

All notable changes to img-man are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CI: blocking Docker build + container smoke-test job.
- Security workflow: Gitleaks (PR diff + weekly full-history scan),
  npm audit (advisory), dependency review (blocks new criticals),
  CycloneDX SBOM artifact.
- Release pipeline: tag-triggered multi-arch (amd64/arm64) images to
  GHCR and (optionally) Docker Hub, with Trivy pre-publish scan,
  build provenance + SBOM attestations, and an auto-generated GitHub
  Release.
- Dependabot for npm (root + workspaces) and GitHub Actions, grouped
  weekly.
- Public docs: architecture, configuration, upgrading, releases,
  support matrix, repository maintenance, GitHub repository setup.
- `copyText()` clipboard helper with `execCommand` fallback so copy
  buttons work inside iframes (embedded dashboard).

### Changed
- Docker image now runs as the unprivileged `node` user and ships a
  `HEALTHCHECK` against `/api/health/live`.
- Docker Compose defaults `HEALTHCHECK_REQUIRE_STORAGE=0` so a fresh
  self-host stack reports healthy without a configured bucket.
- `.env.example` gained `ASSET_URL_SIGNING_SECRET` (already read by the
  storage layer; previously only documented in compose).

### Fixed
- Copy-to-clipboard silently failed inside embedded iframes when the
  Clipboard API was blocked by permissions policy or an insecure
  context.

### Notes
No official releases have been published yet; `0.1.0` in `package.json`
becomes `v0.1.0` when the first release tag is pushed.
