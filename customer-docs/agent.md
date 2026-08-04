# Using the img-man Agent

**Status:** PUBLISHED — 2026-05-06 | **Category:** Developer Surface

img-man ships a built-in AI agent that can search assets, apply edits, and orchestrate multi-step workflows — all from a chat interface in the dashboard or from any MCP-connected tool like Claude Desktop or Cursor.

---

## What it does

The agent uses your configured AI provider (Gemini or OpenAI) to understand natural-language requests and execute them as typed tool calls against your img-man instance. Every tool call is logged to the audit trail. Destructive actions require an explicit confirmation click.

---

## When to use it

- **Bulk operations**: "Tag every image in the /products folder as 'Q2-launch' if it doesn't already have that tag."
- **Discovery workflows**: "Find all product photos with a white background and move them to /clean-cutouts."
- **AI edits at scale**: "Remove the background from every PNG in /raw-shots and save the results to /processed."
- **Migration assistance**: "Dry-run a scan of my existing GCP bucket and give me the cost estimate."

---

## In-app agent (beta)

The in-app agent is beta-flagged at the v1.0 GA release. To enable it:

1. Go to **Settings → AI Provider** and confirm a provider is connected and healthy.
2. Go to **Settings → Feature Flags** and toggle on **Agent (beta)**.
3. Click the chat icon (✨) in the bottom-right corner of any dashboard page.

The agent operates in the context of your current org. It can only see and modify assets your account has permission to access.

### Confirmation for destructive tools

Tools that delete, move, or mutate assets are marked destructive. The agent will always show a confirmation card with:
- The tool name and description.
- The exact parameters it intends to pass.
- An **Approve** / **Cancel** button.

The action does not proceed until you click **Approve**.

### RBAC enforcement

| Role | Agent access |
| --- | --- |
| Owner / Admin | All tools (read + write + destructive) |
| Editor | Non-destructive tools + confirmable write tools |
| Viewer | Read-only tools only (`search`, `get`, `list`, `transform`) |

---

## MCP server

For automation from Claude Desktop, Cursor, VS Code Copilot, or any other MCP-compatible host, use the `@imageman/mcp-server` package.

### Quick setup

```bash
npm install -g @imageman/mcp-server
```

Then add to your host's config (example: Claude Desktop):

```json
{
  "mcpServers": {
    "imageman": {
      "command": "imageman-mcp",
      "env": {
        "IMAGEMAN_BASE_URL": "https://your-imageman-instance.example.com",
        "IMAGEMAN_API_KEY": "im_live_your_key_here"
      }
    }
  }
}
```

See [customer-docs/mcp.md](mcp.md) for setup snippets for Cursor, Continue, and Zed.

### Available tools

| Tool name | Description | Destructive? |
| --- | --- | --- |
| `imageman.asset.search` | Full-text + semantic + filter search | No |
| `imageman.asset.get` | Get a single asset by ID | No |
| `imageman.asset.list` | List assets in a folder (paginated) | No |
| `imageman.asset.tag` | Add or remove tags from an asset | Yes |
| `imageman.transform.url` | Build a deterministic transform URL | No |
| `imageman.transform.bgRemove` | Remove background and return derivative URL | Yes |
| `imageman.ai.image.generate` | Generate an image from a prompt | No |
| `imageman.ai.image.edit` | Edit an existing image with a prompt | Yes |

---

## Cost and quotas

Every tool call that invokes the AI provider bills against your own provider key. img-man does not meter or cap this — set a spend limit on the key itself, and use the per-feature switches under **Settings → AI** to disable expensive operations. See [Usage](features/usage.md).

The agent enforces three hard limits:
- **Per-call ceiling** — a single tool call cannot exceed this cost.
- **Per-session ceiling** — the total cost of one agent session.
- **Per-org daily ceiling** — the org-wide daily spend limit.

When a ceiling is hit, the agent stops and shows a clear message. No partial execution occurs after a cost-cap stop.

---

## Eval harness

The nightly eval harness runs 10 canonical tasks against your configured providers to measure agent reliability. If the pass-rate drops below 80%, the in-app agent is automatically surfaced in warning mode and you receive a dashboard notification.

See [Agent eval harness](agent-eval.md) for details on the tasks and how to read the results.

---

## Tips & limits

- The agent does not have access to the internet. It can only call tools that interact with your img-man instance.
- The agent cannot modify your AI provider settings, API keys, or billing configuration.
- MCP hosts manage their own LLM session context; the MCP server is stateless and does not store conversation history.
- Long-running operations (background remove on 500 images) run as background jobs. The agent returns a job ID; check **Settings → Activity** for progress.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "No AI provider configured" | Go to **Settings → AI Provider** and connect a provider. |
| Tool call fails with "permission denied" | Check your role. Viewers cannot call write tools. |
| Agent stops mid-task with a cost guardrail message | Raise the per-session ceiling in **Settings → AI** or break the task into smaller batches. |
| MCP server returns "unauthorized" | Verify `IMAGEMAN_API_KEY` is a valid live key (`im_live_…`). |
| Eval harness warning in dashboard | Check `eval-results.json` in your instance's data directory for failing task details. |

---

## Related

- [MCP setup guide](mcp.md)
- [Agent eval harness](agent-eval.md)
- [Usage](features/usage.md)
- [API keys](features/api-keys.md)
- [Audit log](audit-log.md)
