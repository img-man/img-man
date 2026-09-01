# Support Matrix

Only what is actually validated. "Tested" = exercised by CI or the
maintainers; "expected" = declared by dependency requirements but not
continuously verified.

## Node.js (running from source)

| Version | Status |
| --- | --- |
| 22.x | **Tested** — CI (ubuntu, Node 22) and `engines: >=22.0.0` |
| ≥ 23 | Expected to work (semver range), not tested in CI |
| < 22 | Unsupported (`engines` blocks install; Next 16 requires ≥ 20) |

## MongoDB

| Version | Status |
| --- | --- |
| 8.0 | **Tested** — pinned by `docker-compose.yml` |
| 6.0 / 7.0 | Expected (mongoose 6-driver compatibility), not tested in CI |
| < 6.0 | Unsupported (mongoose 9 minimum server) |

## Docker

| Component | Minimum | Status |
| --- | --- | --- |
| Docker Engine | 24 (Compose v2 built-in) | Image built/tested on 28.x |
| Compose spec | v2.20+ | `depends_on: condition: service_healthy` requires Compose v2 |

## Container architectures

| Platform | Status |
| --- | --- |
| linux/amd64 | **Published** (release pipeline, CI smoke test) |
| linux/arm64 | Published via buildx/QEMU cross-build; **not yet runtime-tested** on physical arm64 — report issues if you hit any |

## Host operating systems (running from source)

| OS | Status |
| --- | --- |
| Linux | Tested (CI runners) |
| macOS | Expected, used by maintainers, not in CI |
| Windows | Used for development of this repository; not in CI |

## Browsers (dashboard/embed UI)

Evergreen Chrome/Edge/Firefox/Safari — targeted, no automated browser
matrix in CI yet. Embed assumes the parent page can iframe
`/embed/dashboard` (see `allow="clipboard-write"` note in SETUP.md).

## Version support policy

Per SECURITY.md: the **latest released minor** receives security fixes.
Pre-release (`0.x`) versions carry no compatibility promises between
releases — see [upgrading.md](upgrading.md).
