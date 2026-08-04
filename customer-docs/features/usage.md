# Usage

**Status:** PUBLISHED | **Category:** Administration

## What it does

Shows what this workspace has actually consumed — storage, bandwidth, and AI
jobs. That is all it does, because there is nothing to enforce.

**img-man has no plans, tiers, quotas, or credits.** Files live in a bucket you
own and AI calls bill to a key you own, so the only party that can meter you is
your cloud provider. The sidebar shows *used*, never *used of allowed*.

## Where to find it

- **Sidebar** — running storage total, always visible.
- **AI Studio** — number of AI jobs run.
- **Analytics** — bandwidth over time, broken down by upload, download,
  transform, and CDN.

## The API

```text
GET /api/usage
```

Requires an authenticated session with `manage_settings`.

```jsonc
{
  "deployment": "self-hosted",
  "storage":   { "usedBytes": 8123456789 },
  "bandwidth": {
    "usedBytes": 41234567,        // current calendar month
    "cumulativeBytes": 903112884, // since the workspace was created
    "breakdown": { "upload": 0, "download": 0, "transform": 0, "cdn": 0 }
  },
  "aiJobs": { "total": 214 }
}
```

No field in that response is a limit, and none will ever cause a request to be
rejected.

## Controlling cost

Because img-man will not stop you, put the guardrails where the money is:

- **Storage** — set a lifecycle rule on the bucket to expire or downgrade old
  objects, and a budget alert in your cloud console.
- **Bandwidth** — serve through a CDN and prefer `bucket` delivery mode over
  proxying through img-man. See [Transforms](transforms.md).
- **AI** — set a spend cap on the provider key itself. Per-feature switches under
  **Settings → AI** let you disable expensive operations or restrict them to
  higher roles.
- **Retention** — lower `trashRetentionDays` so deleted assets stop occupying
  the bucket sooner.

## Related

- [Analytics](analytics.md)
- [BYOC storage](../byoc.md)
- [AI providers](../ai-providers.md)
- [Telemetry](../telemetry.md)
