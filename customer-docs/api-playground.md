# API Playground

> **Status:** PUBLISHED
> **Last updated:** 2026-05-04
> **Applies to:** API key holders

## What it does

The API Playground lets you explore img-man endpoints in the browser, inspect request shapes, and switch between mock mode and live requests against your running instance.

## When to use it

- You want to understand an endpoint before writing code.
- You need a fast way to try a request with your own API key.
- You are debugging auth, request bodies, or query parameters in a self-hosted deployment.

## Step-by-step

1. Open **API Playground** in the dashboard.
2. Start in **Mock** mode if you only want example payloads.
   Mock mode never sends a real request.
3. Switch to **Live** mode when you want to hit your own img-man instance.
4. Paste an API key into the auth field.
   The key is sent as a bearer token on live requests.
5. Pick an endpoint from the left-hand endpoint list.
   The request builder fills in path params, query params, and sample JSON when they exist.
6. Click **Send** and inspect the response body, status code, and latency.

## What you can test

- Asset listing, lookup, upload, and transform URL generation.
- Folder creation and browsing.
- Share creation and link inspection.
- AI routes that are safe to exercise with your current key and provider setup.

## Tips & limits

- Use **Mock** mode first when you are learning the API surface or demoing it to someone else.
- Live mode requires a real API key with the matching permission for the selected endpoint.
- The playground is an exploration tool, not a secrets vault. Avoid pasting long-lived production keys on shared machines.
- For detailed REST onboarding and copy-paste curl examples, start with [api-reference.md](api-reference.md).

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Live mode returns `AUTH_REQUIRED` | No API key was entered. | Paste a valid API key into the auth field and resend the request. |
| Live mode returns `403` or a permission error | The key exists but does not have the permission required by the selected endpoint. | Create a narrower or broader key in **Settings → API Keys** and retry. |
| The request works in Mock mode but fails in Live mode | Mock mode uses sample payloads; live mode uses the real server contract and runtime config. | Compare the request fields with [api-reference.md](api-reference.md) and your server configuration. |
| A storage-backed endpoint fails in Live mode | Self-host storage is not configured, or BYOC settings are incomplete. | Review [configuration.md](configuration.md) and [byoc.md](byoc.md) before retrying upload or transform flows. |

## Related

- [API reference & quickstart](api-reference.md)
- [API keys](features/api-keys.md)
- [API rate limits](api-rate-limits.md)
- [MCP](mcp.md)