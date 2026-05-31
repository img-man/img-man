# img-man

img-man is the open-source media operating system: a self-hosted stack for asset management, design workflows, PDF tools, AI-powered media operations, and delivery APIs.

> Status: this repository now contains the public split scaffold, a runnable Next.js shell, self-host bootstrap tooling, edition/account contracts, and wrapper-sync workflow. The broader app migration from ImageMan lands into this repo next.

## Why img-man

- Self-hosted first: Docker-friendly, BYO bucket, BYO AI key, no hosted lock-in.
- One stack, not five tools: DAM, design, PDF operations, AI workflows, and delivery in one place.
- Agent-native foundation: the public edition contract is designed for SDK, MCP, and automation surfaces.
- Clean open-core split: commercial cloud support and white-label stay outside this repository.

## What Ships In This Scaffold

- Minimal runnable Next.js public shell with landing page and health endpoints.
- Public repo boundary and search-optimized positioning.
- Self-host environment bootstrap via `scripts/self-host-bootstrap.mjs`.
- Public-purity guard via `scripts/verify-public-purity.mjs`.
- Edition entitlement contract in `packages/imageman-sdk/src/edition.js`.
- Off-by-default managed-account client in `src/lib/edition/account-client.js`.
- Bootstrap tooling for the private wrapper repo via `scripts/subtree-init-private-repo.sh` and `scripts/subtree-init-private-repo.ps1`.

## Quickstart

Install dependencies:

```bash
npm install
```

Run the local app shell:

```bash
npm run dev
```

Health endpoints:

```text
GET /api/health/live
GET /api/health/ready
```

Generate a local self-host env file:

```bash
node scripts/self-host-bootstrap.mjs --file .env.self-host
```

Print it to stdout instead:

```bash
node scripts/self-host-bootstrap.mjs --stdout
```

Validate that the public repo does not leak private-surface references:

```bash
node scripts/verify-public-purity.mjs
```

Run the automated checks:

```bash
npm test
```

Run only unit or end-to-end coverage:

```bash
npm run test:unit
npm run test:e2e
```

Run unit coverage for the migrated feature slices:

```bash
npm run test:coverage
```

## Minimal Config

For the public self-host flow, the intended setup remains simple:

1. Add a MongoDB connection string.
2. Add your AI key.
3. Add your bucket settings.
4. Optionally add `IMAGEMAN_ACCOUNT_KEY` to unlock a managed account.

If `IMAGEMAN_ACCOUNT_KEY` is empty, the repo stays in community mode and makes zero account-service network calls.

The current app shell is deliberately small: it proves the public repo can build, boot, expose health probes, and honor the self-host contract before the larger product migration lands.

The first migrated product utility is deterministic transform URL generation. Use the route below to preview stable cache-keyed transform URLs from the public core:

```text
GET /api/transforms/url?assetId=asset_123&width=800&height=600&format=webp
```

## Open-Source Alternative To

| Category | Proprietary tools | img-man focus |
| --- | --- | --- |
| Image delivery / DAM | Cloudinary, ImageKit, Filestack | Self-owned media delivery, transforms, signed URLs, BYOC storage |
| DAM / brand ops | Bynder, Brandfolder, Canto | Asset governance, metadata, permissions, share workflows |
| Design studio | Canva, Adobe Express | Asset-connected design workflows in a self-hosted stack |
| Gallery intelligence | Google Photos | Semantic search, people, duplicates, and library intelligence |
| PDF tools | iLovePDF, Smallpdf, Sejda, Acrobat | PDF operations inside a real asset platform |
| Image AI | remove.bg, Canva AI | BYOK image generation, editing, tagging, and enhancement |

## Repository Layout

```text
img-man/
  src/app/
  src/lib/
  packages/imageman-sdk/
  scripts/
  PLAN.md
```

This is the new public home for the ImageMan core. The managed wrapper consumes this repo through a subtree or snapshot sync model and applies overlays outside the public tree.

## Roadmap

See `PLAN.md` for the split strategy, README plan, white-sourcing model, and execution phases.

## License

Planned public license: Apache-2.0.
