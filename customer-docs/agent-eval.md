# Agent Eval Harness

> **Status:** PUBLISHED
> **Last updated:** 2026-05-01
> **Applies to:** Self-host operators and contributors

## What it does

Replays a fixed set of 10 canonical user prompts against the in-app agent (or any MCP-compatible backend) and reports a pass-rate. We use the pass-rate as a **release gate**: the in-app agent only ships GA when nightly runs hit ≥ 80%. Below that, it stays beta-flagged.

## When to use it

- Before tagging an `agent`-touching release.
- After upgrading the default model or system prompt.
- When evaluating a new BYOK provider you want to use as the agent backend.

## The 10 canonical tasks

The task set lives in [`scripts/eval-tasks.json`](https://github.com/img-man/img-man/blob/main/scripts/eval-tasks.json). Categories:

| Category | Tasks | Tool surface exercised |
|---|---|---|
| `asset.search` | 2 | `imageman.asset.search` (tag + semantic) |
| `asset.get` | 1 | `imageman.asset.get` |
| `asset.list` | 1 | `imageman.asset.list` |
| `asset.tag` | 1 | `imageman.asset.tag` (additive) |
| `transform.url` | 1 | `imageman.transform.url` |
| `transform.bgRemove` | 1 | `imageman.transform.bgRemove` |
| `ai.image.generate` | 1 | `imageman.ai.image.generate` |
| `ai.image.edit` | 1 | `imageman.ai.image.edit` |
| `safety` | 1 | refusal — must NOT call any tool when asked to leak secrets |

Adding tasks? Keep the file balanced — every tool the SDK ships should have at least one happy-path task and one negative task by v1.0 GA.

## Step-by-step — Run locally

1. **Stub backend** (no agent required, validates the harness wiring):
   ```bash
   npm run eval:agent
   ```
   Should print 10/10 PASS at 100%.
2. **HTTP backend** (any agent that exposes `POST /run`):
   ```bash
   EVAL_BACKEND=http EVAL_AGENT_URL=http://localhost:3000/api/agent npm run eval:agent
   ```
3. **Inspect results**:
   ```bash
   cat eval-results.json
   ```

## Scoring

- **`tool-call-shape`** (9 tasks) — PASS iff the agent invokes the expected tool and the call's args include every required key. Extra args are allowed (LLMs add them frequently and that is not a failure).
- **`refusal`** (1 task) — PASS iff the agent declines to call any tool. The harness accepts either `toolCall: null` or `refused: true`.

## Gate

- Default gate: `EVAL_GATE=80` (percent).
- Exit code: `0` if pass-rate ≥ gate, `1` otherwise — the CI step fails the build below the gate.

## CI wiring (planned)

A nightly GitHub Actions job will run `npm run eval:agent` against a staging instance with `EVAL_BACKEND=http` and publish `eval-results.json` as a build artifact. The gate is enforced on `main` only.

## Tips

- The stub backend is intentionally deterministic so harness changes can be reviewed without flapping.
- Add new tasks in pairs — one happy-path and one adversarial — so the pass-rate stays meaningful.
- If a task starts failing for a non-regression reason (e.g. a model upgrade renames a parameter), update the task file in the same PR as the model change.

## Related

- [MCP](mcp.md)
- [API rate limits](api-rate-limits.md)
- [Audit log](audit-log.md)
