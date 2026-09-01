# Repository Maintenance

Branch/merge policy for `img-man`. Half of this is encoded in the
repository itself; the other half can only be enabled in GitHub's web UI
by someone with admin rights. The two halves are kept clearly separate.

## Intended policy

`main` is the release source of truth and must be protected:

- No direct pushes to `main`.
- No force pushes to `main`.
- Changes only via pull request.
- Required status checks before merge (see below).
- At least one approving review (two for sensitive paths once
  CODEOWNERS teams are configured).
- Conversations must be resolved before merge.
- Branch must be up to date with `main` before merge.

## AUTOMATABLE IN REPOSITORY

These already live in-repo and work without any admin action:

| What | Where |
| --- | --- |
| CI quality gates (purity, SPDX, typecheck, tests, build) | `.github/workflows/ci.yml` |
| Advisory lint + npm audit (documented non-blocking backlog) | `.github/workflows/ci.yml` (advisory job) |
| PR Docker build verification + smoke test | `.github/workflows/ci.yml` (docker job) |
| Secret scanning, dependency audit, dependency review | `.github/workflows/security.yml` |
| Release pipeline (tag-gated, never publishes on failed gates) | `.github/workflows/release.yml` |
| Dependabot (npm root + 2 packages, GitHub Actions; grouped weekly) | `.github/dependabot.yml` |
| Review routing | `.github/CODEOWNERS` |
| Issue/PR templates | `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` |

Recommended **required checks** once branch protection is on
(Settings → Branches → Branch protection rules → Require status checks):

- `Build, Test, Coverage, Purity` (quality job in ci.yml)
- `Docker Compose integration smoke` (ci.yml)
- `Secret scan (Gitleaks)` (security.yml)
- `Dependency review (PRs)` (security.yml) — safe to require (fails only on new criticals)
- `Dependency audit (npm)` is advisory — do **not** require it yet

**Code Owners enforcement:** `.github/CODEOWNERS` references
`@img-man/maintainers`. Whether that team exists in the org cannot be
verified from the repository — **do not enable "Require review from Code
Owners"** (and do not rely on CODEOWNERS approvals) until the team is
created and populated; otherwise GitHub treats the entries as no-owner
paths and, with the setting on, PRs touching them can stall waiting for
an approval that nobody can give. Plain required-reviewer counts work
without the team.

## MANUAL GITHUB SETTINGS (maintainer TODO)

Cannot be set from repository content; someone with org admin must do
these in the GitHub UI (exact values in
[GITHUB-REPOSITORY-SETUP.md](GITHUB-REPOSITORY-SETUP.md)):

1. Branch protection / ruleset on `main`: PR required, no direct pushes,
   no force pushes, required reviews ≥ 1, require conversation
   resolution, require branches up to date, and the required status
   checks listed above.
2. Create the `@img-man/maintainers` team if it does not exist (CODEOWNERS
   references it; "require review from Code Owners" is useless without it).
3. Docker Hub: create the `img-man` repository under the chosen namespace;
   configure `DOCKERHUB_USERNAME` (variable) and `DOCKERHUB_TOKEN`
   (secret) under Settings → Secrets and variables → Actions.
4. GHCR: after the first publish, set the `img-man` package visibility to
   Public.
5. Enable private vulnerability reporting (Settings → Security) —
   SECURITY.md points reporters there.
6. Repository description + topics (see GITHUB-REPOSITORY-SETUP.md).
7. Actions general permissions (Settings → Actions → General):
   - Workflow permissions: **Read repository contents and packages
     permissions** (workflows declare their own elevated scopes).
   - Disable "Allow all repositories and organizations to access
     workflows after approval" — keep the default approve-per-run.

## Release flow

See [releases.md](releases.md). Summary: PR → merge to `main` →
CHANGELOG + version bump → tag `vX.Y.Z` → automation does the rest.
Never push a tag from a dirty tree.

## Lint / audit backlog

`ci.yml` runs lint and npm audit as advisory jobs with a detailed comment
explaining the known failures. When that backlog is cleared:

1. Move `Lint` into the blocking `quality` job (remove `continue-on-error`).
2. Move `npm audit (high+)` into the blocking job or the security
   workflow gate.
3. Update this file, `releases.md`, and the PR template accordingly.
