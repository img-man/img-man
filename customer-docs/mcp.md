# MCP

> **Status:** PUBLISHED
> **Last updated:** 2026-05-01
> **Applies to:** All plans (self-host or cloud)

## What it does

Lets MCP-aware AI clients (Claude Desktop, Cursor, Continue, Zed, OpenAI Agents SDK, …) call your img-man tools over the Model Context Protocol — search assets, generate transform URLs, tag images, and run AI image generation, all from a chat window.

## When to use it

- Letting Claude or Cursor manage your asset library directly from the editor.
- Building agentic workflows that pick the right brand asset for a draft.
- Wiring img-man into a SIEM or internal copilot without writing glue code.

## What you get

The bundled server exposes 8 tools. They map 1:1 to the same REST endpoints the dashboard uses, so there is no second source of truth.

| Tool | Effect | Description |
|---|---|---|
| `imageman.asset.search` | read | Semantic + tag search across the org library. |
| `imageman.asset.get` | read | Fetch metadata + signed URL for one asset. |
| `imageman.asset.list` | read | Paginated listing for a folder or tag. |
| `imageman.asset.tag` | write | Add tags to an asset (additive). |
| `imageman.transform.url` | read | Build a deterministic, cacheable transform URL. |
| `imageman.transform.bgRemove` | write | Background-remove an asset via the active AI provider. |
| `imageman.ai.image.generate` | write | Text-to-image into the org library (costs credits). |
| `imageman.ai.image.edit` | write | Inpaint / outpaint / style-edit an existing asset. |

The full machine-readable contract lives in [`@img-man/sdk` → `src/agent/tools.ts`](https://github.com/img-man/img-man/blob/main/packages/imageman-sdk/src/agent/tools.ts) and is the single source of truth — adding a tool there automatically makes it available over MCP.

## Step-by-step — Install

1. **Install the server.**
   ```bash
   npm i -g @imageman/mcp-server
   ```
2. **Mint an API key.** _Settings → API Keys → Create key_ with the `agent` scope.
3. **Tell your client about it.** Pick one of the snippets below.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "imageman": {
      "command": "imageman-mcp",
      "env": {
        "IMAGEMAN_BASE_URL": "https://your-imageman.example",
        "IMAGEMAN_API_KEY": "im_live_..."
      }
    }
  }
}
```

Restart Claude. The 8 img-man tools should appear in the tool palette.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "imageman": {
      "command": "imageman-mcp",
      "env": {
        "IMAGEMAN_BASE_URL": "https://your-imageman.example",
        "IMAGEMAN_API_KEY": "im_live_..."
      }
    }
  }
}
```

### Continue (VS Code / JetBrains)

Add to your `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "imageman-mcp",
          "env": {
            "IMAGEMAN_BASE_URL": "https://your-imageman.example",
            "IMAGEMAN_API_KEY": "im_live_..."
          }
        }
      }
    ]
  }
}
```

### Zed

In `~/.config/zed/settings.json`:

```json
{
  "experimental": {
    "context_servers": {
      "imageman": {
        "command": "imageman-mcp",
        "env": {
          "IMAGEMAN_BASE_URL": "https://your-imageman.example",
          "IMAGEMAN_API_KEY": "im_live_..."
        }
      }
    }
  }
}
```

## Step-by-step — Verify the connection

In any MCP client, ask:

> "List 5 recent images that contain the tag 'hero'."

You should see the client invoke `imageman.asset.search` and return results. If nothing happens, check the **Troubleshooting** section below.

## Tips & limits

- Every call is authenticated by your API key. Scopes are enforced server-side; an `agent` key cannot escalate to billing endpoints.
- Tool calls count toward the same per-org rate limit as the REST API — see [API rate limits](api-rate-limits.md).
- AI generation tools (`ai.image.generate`, `ai.image.edit`, `transform.bgRemove`) consume credits.
- The server logs to stderr only; stdout is reserved for JSON-RPC traffic. Pipe stderr to a file if you want a transcript.
- The MCP server is a thin adapter — no business logic, no AI provider keys, no storage credentials live in that process.

## Troubleshooting

- **Client doesn't see img-man tools.** Restart the client after editing the config. Check that `imageman-mcp` is on your `PATH`.
- **Every call returns `401`.** Run `imageman-mcp --check` (planned for v0.18) or paste your key into _Settings → API Keys → Diagnose_ to confirm the prefix and environment.
- **"Connection closed" mid-conversation.** Most often a missing env var. The server logs the missing variable to stderr before exiting.
- **Latency feels high.** Tool calls go over your normal HTTPS path; if you see >2s per call, check the network round-trip from the client machine to your img-man instance.

## Related

- [API keys](features/api-keys.md)
- [API rate limits](api-rate-limits.md)
- [Audit log](audit-log.md) — every MCP call is recorded as a normal audit entry.
