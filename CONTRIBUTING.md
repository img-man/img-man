# Contributing to img-man

Thanks for your interest in contributing to **img-man**, the open-source core of
img-man. This repository is the single source of truth for the community
edition. The hosted SaaS lives in a separate private repository that consumes
this code unmodified.

## Ground rules

1. **Public purity.** This repository must never reference private SaaS
   surfaces. CI runs `npm run verify:public-purity` and will fail any PR that
   introduces banned references (cloud/whitelabel/enterprise overlays).
2. **Tests required.** Every behavioral change ships with tests. We target
   90%+ line coverage. Run `npm run test:coverage` before opening a PR.
3. **No TypeScript in the runtime shell.** The community shell uses `.js`,
   `.jsx`, and `.mjs`. SDK contracts live in `packages/`.
4. **Small, focused PRs.** One logical change per PR.

## Developer Certificate of Origin (DCO)

All commits must be signed off under the [DCO](https://developercertificate.org/).
Add a `Signed-off-by` trailer to every commit:

```bash
git commit -s -m "feat: add transform cache key"
```

By signing off you certify that you wrote the patch or otherwise have the right
to submit it under the project's Apache-2.0 license.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit + e2e
npm run test:coverage
npm run verify:public-purity
```

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.

## Reporting bugs

Open an issue with reproduction steps, expected vs. actual behavior, and your
environment (Node version, OS). For security issues, follow SECURITY.md instead
of filing a public issue.
