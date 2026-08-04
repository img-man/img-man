# AI Providers

> **Status:** PUBLISHED
> **Last updated:** 2026-04-30
> **Applies to:** All plans

## What it does

img-man resolves every AI call (text generation, image tagging, embeddings, image generation, image editing) through a **provider registry**. Each organization picks the active provider in **Settings → AI Provider**; runtime helpers honor that choice and automatically fall back to a Vertex baseline when the active provider lacks a capability.

## Capability matrix

`✅` = first-class support · `🔁` = automatic Vertex fallback · `❌` = unsupported · `🟡` = planned

| Capability                  | Vertex (Gemini) | OpenAI         | OpenRouter | Groq |
|-----------------------------|------------------|----------------|------------|------|
| `text.generate`             | ✅ Gemini 2.5    | ✅ GPT-4.1-mini | 🟡 planned | 🟡 planned |
| `vision.tag`                | ✅ Gemini 2.5    | ✅ GPT-4.1-mini | 🟡 planned | 🟡 planned |
| `vision.embed`              | ✅ multimodalembedding@001 | ❌ → 🔁 Vertex | 🟡 planned | 🟡 planned |
| `image.generate`            | ✅ Gemini Flash  | ✅ gpt-image-1 | 🟡 planned | ❌ |
| `image.edit` (generic)      | ✅ Gemini        | ✅ gpt-image-1 | 🟡 planned | ❌ |
| `image.edit.inpaint`        | ✅ Imagen 4 Edit | ✅ gpt-image-1 | 🟡 planned | ❌ |
| `image.edit.outpaint`       | ✅ Imagen 4 Edit | ✅ gpt-image-1 | 🟡 planned | ❌ |
| `image.edit.bg-remove`      | ✅ Imagen 4 Edit | ✅ gpt-image-1 | 🟡 planned | ❌ |
| `image.upscale`             | ✅ Imagen 4 Edit | ❌ → 🔁 Vertex | 🟡 planned | ❌ |
| `agent.tools`               | ❌               | ❌             | 🟡 planned | 🟡 planned |

The capability matrix above is the supported public contract for customer deployments.

## How fallback works

1. The route resolves `aiProviderConfig.provider` for the calling org.
2. The provider-aware helper (`applyAiImageEdit`, `analyzeImageTags`, …) asks the registry whether that provider supports the requested capability.
3. If yes, the helper calls the provider's runtime adapter (e.g. OpenAI → `gpt-image-1`).
4. If no, the helper falls back to **Vertex** with the equivalent default model. The audit trail records both the requested provider and the actual provider that served the request.

This is why OpenAI orgs still get `image.upscale` — the runtime transparently drops back to Vertex's Imagen 4 path.

## Picking a provider

| You want… | Pick |
|-----------|------|
| The smallest infra footprint and one-cloud setup. | **Vertex** (you're already on GCP). |
| Best-in-class natural-language editing prompts and `gpt-image-1`. | **OpenAI**. |
| Aggregated access to many model providers behind one API key. | **OpenRouter** (planned). |
| The fastest text/vision inference for tagging at scale. | **Groq** (planned). |

## Bring your own key (BYOK)

- Each org stores its own provider key, encrypted at rest. See [credential-rotation.md](credential-rotation.md).
- Open `Settings → AI Provider`, choose the provider, paste the key, click **Validate & Save**.
- The key is validated by issuing a small test call (`vision.tag` or `text.generate`) before being saved.

## Settings env-var bootstrap

For self-hosted single-tenant deployments you can pre-seed the provider via env vars (see [configuration.md](configuration.md)):

```env
DEFAULT_AI_PROVIDER=openai           # vertex | openai | openrouter | groq
OPENAI_API_KEY=sk-...                # used when no per-org key is set
```

Per-org keys in MongoDB always win over env-var defaults.

## Tips & limits

- Switching the active provider does **not** rewrite historical AI job records — old jobs keep their original `model`/`provider` values.
- Embeddings are not migrated when you switch providers. New uploads will be embedded with the new provider's vectors; semantic search will not mix vector spaces.
- OpenRouter and Groq are exposed in the registry today as **placeholders** (status `planned`, capability list empty). The Settings UI may render them as "Coming soon"; runtime calls fall back to Vertex.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| AI Studio still uses Vertex after I selected OpenAI. | The capability isn't supported on OpenAI yet (e.g. `image.upscale`). | Either accept the Vertex fallback or use a Vertex-supported workflow. |
| `OpenAI image edit error (401)` | Stored key was revoked or rotated upstream. | Paste a fresh key in Settings → AI Provider. |
| `does not support` thrown at runtime. | A code path called a capability the active provider lacks without going through `applyAiImageEdit` / fallback helpers. | File a bug — every public route must use the fallback helpers. |

## Related

- [storage-providers.md](storage-providers.md) — Sister doc for storage BYOC.
- [credential-rotation.md](credential-rotation.md) — KEK + provider-key rotation.
- [api-rate-limits.md](api-rate-limits.md) — Throughput and retry guidance for AI-backed calls.
