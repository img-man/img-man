# img-man — Open-Source Split & README Plan

**Status:** DRAFT v1
**Owner:** Architecture / Product
**Last meaningful update:** May 31, 2026
**Supersedes:** —
**Superseded by:** —
**Related:** `ImageMan/agent-docs/plans/OPEN_SOURCE_ENTERPRISE_ROADMAP.md` §8 (locked two-repo decision), `image-man-service/PLAN.md` (wrapper companion)

> This plan lives in the **public** repo. It documents how the existing `ImageMan` codebase is split into a clean open-source core (`img-man`) and a private SaaS wrapper (`image-man-service`), modelled on Chatwoot, Documenso, Plane, and Twenty. It also specifies the high-quality, search-optimized README this repo will ship.

---

## Table of Contents

1. [Goal](#1-goal)
2. [Reference Model (open-core SaaS)](#2-reference-model-open-core-saas)
3. [Repository Boundary](#3-repository-boundary)
4. [White-Sourcing Reuse Model](#4-white-sourcing-reuse-model)
5. [Self-Deploy → Connect-to-Account Flow](#5-self-deploy--connect-to-account-flow)
6. [README Plan (high-quality + searchable)](#6-readme-plan-high-quality--searchable)
7. [Open-Source Alternative Positioning](#7-open-source-alternative-positioning)
8. [Execution Phases](#8-execution-phases)
9. [Definition of Done](#9-definition-of-done)

---

## 1. Goal

Ship **one simple, open-source ImageMan core** (`img-man`) that a single user or single org can self-host with Docker or a one-command deploy, and **reuse that exact core inside a commercial SaaS wrapper** (`image-man-service`) using a white-sourcing overlay technique.

Two outcomes:

- **Free community self-deploy** — clone/Docker, bring your own AI key + storage bucket, run it yourself under Apache-2.0.
- **Paid self-deploy + connect-to-account** — operators run their own instance but pay a small fee to link it to a managed account (license, support, updates, optional managed features) served by `image-man-service`.

Non-goals for the public repo: no marketing/pricing pages, no white-label code, no billing logic, no private credentials.

---

## 2. Reference Model (open-core SaaS)

We copy the proven open-core playbook. Each reference pairs a public GitHub repo with a hosted/pricing offering:

| Project | Public repo | Commercial | Pattern we borrow |
| --- | --- | --- | --- |
| Chatwoot | `chatwoot/chatwoot` | chatwoot.com/pricing | "Open-source alternative to Intercom/Zendesk" framing; self-host vs cloud parity; enterprise edition folder gated by license. |
| Documenso | `documenso/documenso` | documenso.com/pricing | "Open-source DocuSign alternative"; clean self-host docs; single-tenant first, cloud second. |
| Plane | `makeplane/plane` | plane.so/pricing | One-command Docker setup; community vs cloud vs enterprise tiers; strong README IA. |
| Twenty | `twentyhq/twenty` | twenty.com/pricing | "Open-source CRM, alternative to Salesforce"; modern monorepo; transparent roadmap; hosted = same code + managed ops. |

Shared takeaways adopted by `img-man`:

1. **Same code, two distributions.** The hosted product is the open-source core plus a thin managed layer — never a fork.
2. **Self-host is first-class**, not a degraded demo. Docker one-liner + `.env.example` only.
3. **"Open-source alternative to X"** is the headline SEO/positioning lever.
4. **Enterprise/cloud code lives outside the open-source tree** behind an edition manifest, not inline conditionals.
5. **BYO keys/buckets** so the project never resells storage/AI in the free tier.

---

## 3. Repository Boundary

Aligns with the locked decision in `ImageMan/agent-docs/plans/OPEN_SOURCE_ENTERPRISE_ROADMAP.md` §8.

### 3.1 `img-man` (this repo — public, Apache-2.0)

Includes:

- Asset management, design studio, gallery intelligence, PDF tools, transforms/delivery, API, SDK, MCP server, agent runtime.
- Storage adapters (GCP, AWS S3) and AI provider adapters (Vertex/Gemini, OpenAI) — **contracts + community adapters only**.
- Own authentication, user/admin controls, docs (`/docs`).
- Single-operator / single-org deployment as the default mental model.
- `Dockerfile`, `docker-compose.yml`, `.env.example`, health endpoints, self-host bootstrap script.
- Edition manifest + extension contracts (so the wrapper can plug in without forking).
- An **optional, off-by-default "connect to account"** client that talks to `image-man-service` (see §5). Ships disabled; no account = fully functional.

Excludes (never in this repo): marketing/pricing/landing pages, white-label embed shells, billing, white-sourcing handoff tooling, private templates, production credentials.

### 3.2 `image-man-service` (private wrapper — FSL-1.1-Apache)

- Pulls `img-man` into `upstream/img-man/` via `git subtree` (preferred) or `robocopy` snapshot fallback.
- Adds: landing + pricing + waitlist, cloud-support console, white-label embed, premium templates, license/account API that the public "connect" client calls.
- Applies private overlays **outside** `upstream/img-man/`.

### 3.3 Enforcement (carried over from ImageMan)

- Public code must **never** import private packages — ESLint `no-restricted-imports` + `dependency-cruiser` + `scripts/verify-public-purity.ts`.
- SPDX headers: `Apache-2.0` in public, `LicenseRef-ImageMan-FSL-1.1` in private overlays.
- `gitleaks` + `trufflehog` on every PR in both repos.

---

## 4. White-Sourcing Reuse Model

"White-sourcing" = the SaaS wrapper consumes the public source as an upstream dependency and layers commercial features on top, without modifying the upstream tree.

```text
img-man (public, source of truth)
   │  git subtree push/pull (squash)
   ▼
image-man-service/
   upstream/img-man/        ← read-only mirror of this repo
   overlays/                ← files applied over the core at build time
   packages/whitelabel/     ← branded shell, themes
   packages/cloud-support/  ← diagnostics, license, account API
   apps/landing/            ← pricing + waitlist
```

Rules:

1. `img-man` is the single source of truth for core product code.
2. Fixes to shared code go **upstream first**, then sync down.
3. Overlays are small, explicit, and live outside `upstream/img-man/`.
4. White-label is activated through the **edition manifest + plugins**, not hardcoded public conditionals.
5. A weekly CI job in the private repo opens an automated `git subtree pull` PR.
6. A `verify-private-build` script must build both public-only and private-overlay modes each release.

Sync commands (reference):

```powershell
git subtree add  --prefix upstream/img-man https://github.com/img-man/img-man.git main --squash
git subtree pull --prefix upstream/img-man https://github.com/img-man/img-man.git main --squash
```

---

## 5. Self-Deploy → Connect-to-Account Flow

The monetization hook for self-hosters: they run the free core, then optionally **pay a small fee to connect their instance to a managed account**.

Design constraints:

- The core is **100% functional with no account**. Connecting is purely additive.
- "Connect" is an off-by-default client in `img-man` (`lib/edition/account-client`) that:
  1. Reads `IMAGEMAN_ACCOUNT_KEY` from env (empty = community mode, no network calls).
  2. On boot, validates the key against `image-man-service` and caches an entitlement manifest.
  3. Enables managed extras the entitlement allows (e.g., hosted updates feed, support bundle upload, premium templates sync, white-label unlock).
- Easy setup is the product: **paste your AI key, paste your bucket id, (optionally) paste your account key.** Three fields, working instance.

```text
[ Operator self-hosts img-man ]
        │  docker compose up
        ▼
[ Settings wizard: AI key + bucket id ]  ──► fully working, free, Apache-2.0
        │  (optional) paste account key
        ▼
[ image-man-service validates key ] ──► entitlements: updates / support / white-label
```

Public repo responsibilities: define the entitlement contract + client, ship it disabled, document it. Private repo owns the actual account/license/billing server.

---

## 6. README Plan (high-quality + searchable)

Model the structure on Twenty/Plane/Documenso READMEs — scannable, badge-rich, SEO-loaded. Target section order:

1. **Hero** — logo/banner, one-line tagline, primary badges (license, build, Docker pulls, Discord, stars).
2. **One-liner positioning** — _"The open-source media operating system — an open-source alternative to Cloudinary, ImageKit, Canva, and iLovePDF."_
3. **Screenshots / GIF** — dashboard, design studio, PDF grid, gallery.
4. **Why img-man** — 4–6 bullet value props (self-hosted, BYOC/BYOK, agent-native, DAM + design + PDF in one).
5. **Features** — grouped, emoji-prefixed, scannable (Assets, Design Studio, PDF Tools, AI/Agent, Delivery/API, Self-Host).
6. **Quickstart** — Docker one-liner first, then `docker compose`, then manual. Copy-paste blocks.
7. **Open-source alternative to…** table (see §7) — strong SEO + comparison intent capture.
8. **Configuration** — minimal env: AI key, bucket id; link to `.env.example`.
9. **Deploy** — one-click buttons (Render/Railway/Vercel where applicable) + Docker image.
10. **Architecture** — short diagram + link to docs.
11. **Roadmap** — link to public roadmap.
12. **Community & Contributing** — Discord, CONTRIBUTING (DCO), good-first-issue label.
13. **Cloud / Paid option** — short, honest paragraph linking to image-man-service (self-deploy + connect-to-account), no hype.
14. **License** — Apache-2.0.

SEO/searchability tactics:

- Repo description + topics: `dam`, `image-cdn`, `canva-alternative`, `cloudinary-alternative`, `imagekit-alternative`, `pdf-tools`, `self-hosted`, `nextjs`, `open-source`.
- Keyword-rich H2s ("Open-source Cloudinary alternative", "Self-hosted DAM").
- Comparison table targets "X alternative" search intent.
- Alt text on all images; descriptive anchor links.

---

## 7. Open-Source Alternative Positioning

The README centerpiece — capture comparison search intent the way Twenty (Salesforce), Plane (Jira), Documenso (DocuSign), and Chatwoot (Intercom) do.

| Category | Proprietary leaders | img-man is the open-source alternative for… |
| --- | --- | --- |
| Image delivery / DAM | Cloudinary, ImageKit, Filestack | Self-owned media CDN, transforms, signed delivery, BYOC storage. |
| Enterprise DAM | Bynder, Canto, Brandfolder | Asset governance, metadata, roles, share portals (white-label). |
| Design studio | Canva, Adobe Express | Asset-connected design + templates + export, self-hosted. |
| Gallery intelligence | Google Photos | Team-owned semantic search, people, duplicates, maps. |
| PDF tools | iLovePDF, Smallpdf, Sejda, Adobe Acrobat | Merge/split/compress/convert/sign/OCR inside a real DAM, BYOK AI. |
| Image AI utilities | remove.bg, Canva AI | BYOK background-remove, generate, tag, upscale. |

Headline claim (single line): **"img-man is the open-source media OS — one self-hosted stack that replaces Cloudinary + Canva + iLovePDF + Bynder."**

---

## 8. Execution Phases

| Phase | Scope | Output |
| --- | --- | --- |
| P0 — Scaffold | Initialize `img-man` from the ImageMan public-pure subset; wire `git subtree` from ImageMan or designate `img-man` as new source of truth. | Building public repo, CI green, public-purity passes. |
| P1 — README + positioning | Ship the §6 README, badges, screenshots, topics, comparison table. | Launch-quality README. |
| P2 — Connect client | Edition manifest + off-by-default account client + entitlement contract (§5). | Community mode works with zero account; connect path documented. |
| P3 — Wrapper bootstrap | Scaffold `image-man-service` with `upstream/img-man` subtree, landing/pricing/waitlist, account/license server. | Private build verifies public-only + overlay modes. |
| P4 — Connect-to-account | Implement paste-account-key → entitlements (updates/support/white-label). | Paid self-deploy path live behind waitlist. |

---

## 9. Definition of Done

- [ ] `img-man` builds and runs standalone with only AI key + bucket id configured.
- [ ] No marketing/pricing/white-label/billing code in `img-man`; `verify-public-purity` passes.
- [ ] Account client ships disabled; zero network calls when `IMAGEMAN_ACCOUNT_KEY` is empty.
- [ ] README matches §6 structure, includes the §7 comparison table, and carries correct topics/badges.
- [ ] `image-man-service` consumes `img-man` via `git subtree` and builds both public-only and overlay modes.
- [ ] License headers correct (Apache-2.0 public; FSL in private overlays).
- [ ] Sync runbook documented in both repos.
</content>
</invoke>
