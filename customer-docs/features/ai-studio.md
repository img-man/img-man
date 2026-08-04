# AI Studio

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans (BYOK supported)

## What it does

AI Studio is the single page where you run AI image operations on assets you already own — background remove, upscale, expand (outpaint), edit by prompt, and generate from scratch.

## When to use it

- Cleaning a photo's background for a product page.
- Upscaling a small social asset to print resolution.
- Generating variants ("same shot, sunset light").
- Turning a sketch into a finished hero image.

## Step-by-step

1. Open **AI Studio** in the sidebar.
2. Pick a **tool**:
   - **Remove background** — mask in seconds.
   - **Upscale 2× / 4×** — preserves details.
   - **Expand** — adds new pixels around your image.
   - **Edit by prompt** — "make the background cyberpunk".
   - **Generate** — text-to-image from scratch.
3. Choose an asset from your library (or upload).
4. Click **Run**. Progress streams live; the result lands as a new asset in your library.

## BYOK (Bring Your Own Key)

Under **Settings → AI Providers** you can add your own API key for OpenAI, Google Vertex AI, or Replicate. Keys are stored encrypted and used in place of our managed quota — your bill, your rate limits.

## Tips & limits

- Each operation bills directly to your own AI provider key. The run dialog shows a relative cost weight so you can tell the cheap operations from the expensive ones.
- Outputs are stored as new assets — your originals are never overwritten.
- Generation respects your safety policy (set under Settings → AI).

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Job stuck "queued" | Provider rate limit. | Switch provider or wait. |
| "Insufficient credits" | Plan quota exhausted. | Upgrade plan or add a BYOK key. |
| Output cropped weirdly | Aspect ratio mismatch on Expand. | Adjust target dimensions, retry. |

## Related

- [Assets](assets.md)
- [Designs](designs.md)
- Plan & usage — available in-app under the dashboard billing surface.
