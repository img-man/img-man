# API Rate Limits

> **Status:** PUBLISHED
> **Last updated:** 2026-05-01
> **Applies to:** All plans (limits scale with plan)

## What it does

Caps how many requests an organization can send to the img-man REST API, the SDK, and the MCP server in a rolling window — so a runaway script can't degrade the service for everyone else.

## When to use it

- Sizing a backfill or migration script.
- Diagnosing `429 Too Many Requests` responses.
- Planning a high-traffic launch (mass upload, AI batch, embed widget rollout).

## Limits

| Surface | Free | Pro | Enterprise |
|---|---|---|---|
| Public REST (`/api/v1/*`) | 60 req/min | 600 req/min | 6 000 req/min |
| Asset upload (`POST /api/v1/assets`) | 30 req/min | 300 req/min | 3 000 req/min |
| AI image generate / edit | 10 req/min | 60 req/min | 600 req/min |
| Transform URL build (no upstream call) | unlimited | unlimited | unlimited |
| MCP `tools/call` | shares the public REST budget |
| Webhook deliveries (outbound) | 50 req/min per endpoint |

Limits are **per organization**, not per key. Splitting traffic across multiple API keys does not raise the cap.

## Headers

Every response includes:

```
X-RateLimit-Limit:     600
X-RateLimit-Remaining: 487
X-RateLimit-Reset:     1714560000   # Unix epoch seconds
Retry-After:           4            # only on 429
```

Honour `Retry-After` — exponential backoff with jitter is the recommended client strategy.

## Burst handling

A small burst (10× the per-minute limit, capped at 1 000 requests) is allowed in any 1-second window. Sustained traffic above the per-minute limit is rejected with `429`.

## Quotas vs limits

Rate limits cap **requests per minute** and protect the instance from a runaway client. They are the only limit img-man enforces — there are no storage, bandwidth, or AI quotas, so a `429` is always a rate limit and never a plan ceiling.

## Tips

- Batch tag updates with `POST /api/v1/assets/bulk-tag` (1 request) instead of N single tag calls.
- Use the `imageman.transform.url` tool / SDK helper for transforms — it builds the URL client-side and never counts toward your limit.
- Schedule large migrations during off-hours; the system's nightly index rebuilds run between 03:00–05:00 UTC and your job will get more headroom.

## Related

- [API keys](features/api-keys.md)
- [MCP](mcp.md)
- [Audit log](audit-log.md)
