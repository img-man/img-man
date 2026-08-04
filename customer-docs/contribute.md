# Contribute

> **Status:** PUBLISHED
> **Last updated:** 2026-05-04
> **Applies to:** Contributors to the public core

## What it does

This page explains the expected workflow for contributing code, docs, or tests to the public img-man repository.

## When to use it

- You want to fix a bug or ship a small improvement.
- You are preparing a pull request against the public core.
- You need the minimum local setup and validation steps before opening a PR.

## Step-by-step

1. Pick a narrow issue, regression, or roadmap item.
   Large changes should start with an issue or design note before the PR is opened.
2. Set up your local environment.
   Install Node.js 20+, run `npm install`, copy `.env.example` to `.env`, and start the app with `npm run dev`.
3. Make the smallest change that solves the problem.
   Keep public-core work free of private white-label dependencies and update docs when behavior changes.
4. Validate before opening the PR.
   Start with the narrowest check that covers your change, then broaden as needed. The standard baseline is:
   ```bash
   npm run build
   npm run test:run
   npm run lint
   ```
5. Open the pull request with a clear summary.
   Explain the user-facing impact, link the issue or roadmap item, and include screenshots for UI changes.

## Tips & limits

- Add or update tests for user-facing behavior and regressions.
- Do not commit credentials, generated secrets, or local service-account files.
- Keep pull requests focused. Unrelated cleanup should be split into a separate change.
- Sign commits off with DCO if required by your workflow: `git commit -s -m "Your message"`.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Local setup fails after `npm install` | Node version or environment is out of date. | Move to Node.js 20+ and recreate local dependencies before retrying. |
| CI fails on docs or tests after a seemingly small change | Shared surfaces were changed without matching docs or coverage updates. | Update the relevant docs and add or fix the missing test, then rerun the narrowest affected checks locally. |
| You are unsure whether a change belongs in the public repo | The feature may depend on private white-label overlays or unpublished business logic. | Keep the change in the public core only if it has no private dependency and can ship under the public license. |

## Related

- [Getting started](getting-started.md)
- [Self-hosting](self-hosting.md)
- [Agent eval harness](agent-eval.md)