# Telemetry

**Status:** PUBLISHED | **Category:** Privacy & Compliance

**img-man does not collect telemetry.**

There is no analytics SDK, no usage beacon, no crash reporter, no licence check,
and no "anonymous statistics" toggle. A running img-man instance makes outbound
network requests to exactly three categories of host, all of which you
configured yourself:

| Destination | Why | How to remove it |
| --- | --- | --- |
| Your MongoDB server | Application data | Required |
| Your storage bucket | Uploads, downloads, thumbnails | Required |
| Your AI provider | Only when an AI feature runs | Leave the AI key unset |

Optional integrations you may enable — stock photo sources, font catalogues —
add their own hosts. Those are opt-in and listed under **Settings → Integrations**.

---

## Verifying this yourself

You do not have to take our word for it. From a clean checkout:

```bash
grep -rIn "posthog\|segment\.io\|mixpanel\|amplitude\|plausible\|sentry" src packages
```

The search returns nothing. If you would rather confirm at runtime, run the
instance behind an egress firewall that allows only your database, bucket, and
AI provider — img-man will not attempt anything else.

---

## What is logged locally

img-man records operational data **inside your own database**, never anywhere
else:

- **Activity log** — who did what, for the audit trail. See [Audit Log](audit-log.md).
- **Bandwidth counters** — upload/download/transform byte totals per workspace.
- **Asset analytics** — per-asset view and download counts, off by default
  (`ENABLE_ASSET_ANALYTICS`). Raw records are pruned on the retention window you
  configure.
- **Error log** — server exceptions, for your own debugging.

All of it lives in your MongoDB and is deleted when you delete it.

---

## Related

- [Privacy and Data Handling](privacy.md)
- [Audit Log](audit-log.md)
- [Self-hosting](self-hosting.md)
