# Tools (PDF, Images, Conversion)

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

The Tools page is a grab-bag of single-purpose utilities for files in your library: PDF merge/split/compress, format conversion, OCR, batch resize, EXIF strip, and more.

## When to use it

- One-off file cleanup that doesn't justify a design.
- Bulk conversion (e.g. all PNG → WebP for the web).
- Pulling text out of scanned PDFs or images (OCR).

## Available tools

### PDF

- **Merge** several PDFs into one.
- **Split** a PDF by page range.
- **Compress** a PDF for email.
- **PDF → Images** (one image per page).
- **Images → PDF** (combine into a single PDF).
- **OCR PDF** (recognize text and add a searchable layer).

### Images

- **Convert format** — JPEG/PNG/WebP/AVIF.
- **Batch resize** — apply one size to many.
- **Strip EXIF** — remove camera/location metadata before sharing.
- **Compress** — pick target size or quality.

### Documents

- **DOCX / PPTX → PDF**
- **CSV → XLSX**
- **Extract text** from any document.

## Step-by-step

1. Open **Tools**.
2. Click a tool tile.
3. Pick assets from your library (or drop new files into the picker).
4. Configure options (e.g. quality, target size, page ranges).
5. **Run**. Outputs land as new assets in your library.

## Tips & limits

- Tools run server-side — your browser doesn't have to be open after the job starts.
- Per-tool size limits apply (most cap at 500 MB per input file).
- Outputs respect the same retention/Trash policy as any other asset.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Tool greyed out | Your role lacks `write` permission. | Ask an admin. |
| OCR result is gibberish | Source quality too low. | Re-scan at ≥300 DPI. |
| Output not in library | Job still running. | Check **Activity** in the top bar. |

## Related

- [Assets](assets.md)
- Plan & usage — available in-app under the dashboard billing surface.
