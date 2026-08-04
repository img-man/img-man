// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import {
  getGeminiFlashImageModel,
  parseTextResponse,
  imagePromptParts,
} from '@/lib/vertex-ai';
import { getSignedDownloadUrl } from '@/lib/storage';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiVisionText } from '@/lib/openai';
import { getDefaultModelForProviderCapability } from '@/lib/ai-models';
import { providerSupportsCapability } from '@/lib/ai-providers';

/**
 * POST /api/ai/caption
 * Body: { assetId: string } or { assetIds: string[] } for bulk mode
 *
 * DS-5.9 — AI Caption & Alt-Text Generator
 * Returns: short description, detailed description, hashtags, SEO alt-text.
 * Bulk mode: pass assetIds array to generate captions for multiple images.
 * Credit cost: 1 per image
 */

export interface CaptionResult {
  [key: string]: unknown;
  assetId: string;
  shortDescription: string;
  detailedDescription: string;
  hashtags: string[];
  altText: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support single or bulk mode
    const assetIds: string[] = body.assetIds
      ? body.assetIds
      : body.assetId
        ? [body.assetId]
        : [];

    if (assetIds.length === 0) {
      return NextResponse.json(
        { error: 'assetId or assetIds required' },
        { status: 400 },
      );
    }

    if (assetIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 images per bulk caption request' },
        { status: 400 },
      );
    }

    const results: CaptionResult[] = [];
    const errors: { assetId: string; error: string }[] = [];

    // Process each image (sequentially to respect credit/rate limits)
    for (const currentAssetId of assetIds) {
      try {
        const jobResult = await runAiJob(
          { type: 'caption', assetId: currentAssetId, input: {} },
          async ({ asset, orgId }) => {
            if (!asset) throw new Error('Asset not found');

            const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);
            const aiProviderConfig = await getOrgAiProviderConfig(orgId);
            const activeAnalysisProvider = providerSupportsCapability(
              aiProviderConfig.provider,
              'vision.tag',
            )
              ? aiProviderConfig.provider
              : 'vertex';
            const modelConfig =
              getDefaultModelForProviderCapability(activeAnalysisProvider, 'analyze')
              ?? getDefaultModelForProviderCapability('vertex', 'analyze');

            if (!modelConfig) {
              throw new Error('No analysis model is configured');
            }

            const captionPrompt = [
              'Analyze this image and return a JSON object with exactly these fields:',
              '{',
              '  "shortDescription": "A concise 1-sentence description (max 120 chars)",',
              '  "detailedDescription": "A detailed 2-4 sentence description covering subject, setting, mood, and key visual elements",',
              '  "hashtags": ["relevant", "hashtags", "without-hash-symbol", "5-10-tags"],',
              '  "altText": "SEO-friendly alt text for web accessibility (max 125 chars, descriptive, no \'image of\' prefix)"',
              '}',
              'Return ONLY the JSON object, no markdown formatting or code blocks.',
            ].join('\n');

            const textResult = activeAnalysisProvider === 'openai'
              ? await generateOpenAiVisionText({
                apiKey: aiProviderConfig.openAiApiKey,
                imageUrl,
                model: modelConfig.modelId,
                orgId,
                prompt: captionPrompt,
              })
              : parseTextResponse(
                await (await getGeminiFlashImageModel(orgId, modelConfig.modelId)).generateContent({
                  contents: [
                    {
                      role: 'user',
                      parts: imagePromptParts(imageUrl, asset.mimeType, captionPrompt),
                    },
                  ],
                }),
              );
            if (!textResult) {
              throw new Error('AI did not return a text result');
            }

            // Parse JSON response
            let parsed: CaptionResult;
            try {
              // Strip markdown code fences if present
              const cleaned = textResult
                .replace(/^```(?:json)?\s*/m, '')
                .replace(/\s*```$/m, '')
                .trim();
              const raw = JSON.parse(cleaned);
              parsed = {
                assetId: currentAssetId,
                shortDescription: String(raw.shortDescription || ''),
                detailedDescription: String(raw.detailedDescription || ''),
                hashtags: Array.isArray(raw.hashtags)
                  ? raw.hashtags.map(String)
                  : [],
                altText: String(raw.altText || ''),
              };
            } catch {
              // Fallback: use the raw text as description
              parsed = {
                assetId: currentAssetId,
                shortDescription: textResult.slice(0, 120),
                detailedDescription: textResult,
                hashtags: [],
                altText: textResult.slice(0, 125),
              };
            }

            // Save to asset fields
            asset.description = parsed.detailedDescription;
            asset.altText = parsed.altText;
            if (!asset.tags) asset.tags = [];
            // Merge AI hashtags with existing tags (dedupe)
            const allTags = new Set([
              ...asset.tags,
              ...parsed.hashtags,
            ]);
            asset.tags = Array.from(allTags);
            await asset.save();

            return parsed;
          },
        );

        if (jobResult.status === 'completed' && jobResult.result) {
          results.push(jobResult.result as unknown as CaptionResult);
        } else {
          errors.push({
            assetId: currentAssetId,
            error: jobResult.error || 'Job failed',
          });
        }
      } catch (err: unknown) {
        errors.push({
          assetId: currentAssetId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      total: assetIds.length,
      succeeded: results.length,
      failed: errors.length,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status });
  }
}
