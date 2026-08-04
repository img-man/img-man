// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { getSignedDownloadUrl } from '@/lib/storage';
import { generateImageAnalysisText } from '@/lib/ai-analysis';

/**
 * POST /api/ai/smart-crop
 * Body: { assetId: string, aspectRatios?: string[] }
 *
 * DS-5.3 — AI Smart Crop
 * AI detects the main subject and suggests optimal crop regions
 * for different aspect ratios. Returns multiple crop suggestions.
 * Credit cost: 1
 */

const DEFAULT_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

function parseCropSuggestions(raw: string): CropSuggestion[] | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();
    const parsed = JSON.parse(cleaned) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as CropSuggestion[];
    }

    if (
      parsed
      && typeof parsed === 'object'
      && Array.isArray((parsed as { suggestions?: unknown }).suggestions)
    ) {
      return (parsed as { suggestions: CropSuggestion[] }).suggestions;
    }
  } catch {
    return null;
  }

  return null;
}

export interface CropSuggestion {
  aspectRatio: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export async function POST(req: NextRequest) {
  try {
    const { assetId, aspectRatios = DEFAULT_ASPECT_RATIOS } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const jobResult = await runAiJob(
      { type: 'smart_crop', assetId, input: { aspectRatios } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imgW = asset.width ?? 1000;
        const imgH = asset.height ?? 1000;

        // 1. Get signed URL
        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        // 2. Build analysis prompt
        const prompt = [
          `Analyze this ${imgW}x${imgH} image and detect the main subject(s) and points of interest.`,
          `For each of the following aspect ratios, suggest the optimal crop rectangle that:`,
          `- Centers on the main subject`,
          `- Follows rule-of-thirds when possible`,
          `- Maximizes the image area used`,
          ``,
          `Aspect ratios: ${aspectRatios.join(', ')}`,
          ``,
          `For EACH aspect ratio, provide 2 suggestions:`,
          `1. "centered" — centered on the primary subject`,
          `2. "rule-of-thirds" — following rule-of-thirds composition`,
          ``,
          `Return ONLY a JSON array of objects with this exact schema:`,
          `[{`,
          `  "aspectRatio": "16:9",`,
          `  "label": "centered" | "rule-of-thirds",`,
          `  "x": <top-left x in pixels>,`,
          `  "y": <top-left y in pixels>,`,
          `  "width": <crop width in pixels>,`,
          `  "height": <crop height in pixels>,`,
          `  "confidence": <0.0 to 1.0>`,
          `}]`,
          ``,
          `IMPORTANT: All coordinates must be within bounds (0 ≤ x ≤ ${imgW}, 0 ≤ y ≤ ${imgH}).`,
          `Width and height must respect the exact aspect ratio.`,
          `Maximize the crop area while staying within bounds.`,
        ].join('\n');

        // 3. Run provider-aware visual analysis for crop suggestions
        const { text } = await generateImageAnalysisText({
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt,
        });

        // 4. Parse JSON response
        const parsedSuggestions = parseCropSuggestions(text);
        const suggestions: CropSuggestion[] = parsedSuggestions
          ?? (() => {
          // Fallback: generate default centered crops
          return aspectRatios.flatMap((ratio: string) => {
            const [rw, rh] = ratio.split(':').map(Number);
            const targetRatio = rw / rh;
            let cropW: number, cropH: number;
            if (imgW / imgH > targetRatio) {
              cropH = imgH;
              cropW = Math.round(imgH * targetRatio);
            } else {
              cropW = imgW;
              cropH = Math.round(imgW / targetRatio);
            }
            const x = Math.round((imgW - cropW) / 2);
            const y = Math.round((imgH - cropH) / 2);
            return [
              {
                aspectRatio: ratio,
                label: 'centered',
                x,
                y,
                width: cropW,
                height: cropH,
                confidence: 0.5,
              },
            ];
          });
        })();

        // 5. Validate and clamp suggestions
        const validated = suggestions
          .filter(
            (s) =>
              s.aspectRatio &&
              s.x >= 0 &&
              s.y >= 0 &&
              s.width > 0 &&
              s.height > 0,
          )
          .map((s) => ({
            ...s,
            x: Math.min(s.x, imgW - 1),
            y: Math.min(s.y, imgH - 1),
            width: Math.min(s.width, imgW - s.x),
            height: Math.min(s.height, imgH - s.y),
            confidence: Math.max(0, Math.min(1, s.confidence ?? 0.8)),
          }));

        return {
          suggestions: validated,
          imageWidth: imgW,
          imageHeight: imgH,
        };
      },
    );

    const status = jobResult.status === 'completed' ? 200 : 500;
    return NextResponse.json(jobResult, { status });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status });
  }
}
