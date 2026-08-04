# @img-man/mcp-server

Model Context Protocol (MCP) server that exposes the img-man **Tool Registry** to MCP-aware clients (Claude Desktop, Cursor, Continue, …) so an LLM can search assets, generate transform URLs, tag images, and run AI image generation against a self-hosted or cloud img-man instance.

> Status: **D50 scaffold (v0.16.0).** Tool surface is wired against the public `@img-man/sdk` registry; the runtime delegates to your img-man instance over HTTPS using a personal API key.

## Quick start

### 1. Install

```bash
npm i -g @img-man/mcp-server
```

### 2. Get an API key

In your img-man dashboard: **Settings → API Keys → Create key** (scope: `agent`).

### 3. Configure your MCP client

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "imageman": {
      "command": "imageman-mcp",
      "env": {
        "IMGMAN_BASE_URL": "https://your-imageman.example",
        "IMGMAN_API_KEY": "im_live_..."
      }
    }
  }
}
```

#### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "imageman": {
      "command": "imageman-mcp",
      "env": {
        "IMGMAN_BASE_URL": "https://your-imageman.example",
        "IMGMAN_API_KEY": "im_live_..."
      }
    }
  }
}
```

Restart your client. The first 8 img-man tools should appear in the tool palette.

## Exposed tools (D50)

| Tool | Effect | Description |
|---|---|---|
| `imageman.asset.search` | read | Semantic + tag search across the org library. |
| `imageman.asset.get` | read | Fetch metadata + signed URL for a single asset. |
| `imageman.asset.tag` | write | Add/remove tags on an asset. |
| `imageman.asset.list` | read | Paginated listing for a folder or tag. |
| `imageman.transform.url` | read | Build a deterministic, cacheable transform URL. |
| `imageman.transform.bgRemove` | write | Background removal via the active AI provider. |
| `imageman.ai.image.generate` | write | Text-to-image into the org library (costs credits). |
| `imageman.ai.image.edit` | write | Image edit (inpaint / outpaint / style) on an existing asset. |

The full machine-readable contract lives in [`@img-man/sdk` → `src/agent/tools.ts`](../imageman-sdk/src/agent/tools.ts) and is re-exported here as the canonical source of truth. Every tool added to the SDK registry automatically becomes available over MCP.

## Architecture

```
MCP client (Claude / Cursor)
        │
        │   stdio JSON-RPC 2.0
        ▼
@img-man/mcp-server (this package)
        │
        │   HTTPS + API key
        ▼
img-man instance (/api/v1/agent/tools/:name/invoke)
```

The server is intentionally a **thin adapter**:

1. Loads the canonical `DEFAULT_TOOLS` list from `@img-man/sdk`.
2. Translates MCP `tools/list` and `tools/call` requests into img-man REST calls.
3. Streams structured results back over stdio.

No business logic, no AI provider keys, no storage credentials live in this process — the img-man instance enforces auth, scopes, rate limits, audit logging, and credit accounting.

## Development

```bash
npm install
npm run build
node dist/bin.js   # speak JSON-RPC on stdin/stdout
```

Logging goes to **stderr only** so it cannot corrupt the stdio channel.

## Roadmap

- D54 — integration smoke tests with a real img-man instance.
- D58 — wire the in-app agent UI (alpha) against the same tool registry.
- v1.x — HTTP/SSE transport for hosted MCP gateways.

License: Apache-2.0.
