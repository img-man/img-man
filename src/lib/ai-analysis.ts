// SPDX-License-Identifier: Apache-2.0
import type { AiProviderId } from '@/types/providers';
import { getOrgAiProviderConfig } from './ai-provider-config';
import { getDefaultModelForProviderCapability } from './ai-models';
import { generateOpenAiVisionText } from './openai';
import { providerSupportsCapability } from './ai-providers';
import { getGeminiFlashImageModel } from './vertex-ai';

const IMAGE_TAG_ANALYSIS_PROMPT = `Analyze this image and return a JSON object with:
- "tags": array of descriptive keyword tags (max 20)
- "description": one-line description of the image
Return ONLY valid JSON, no markdown.`;

const FACE_DETECTION_EMOTIONS = new Set([
  'happy',
  'sad',
  'neutral',
  'surprised',
  'angry',
  'fearful',
  'disgusted',
]);

export interface AnalyzeImageInput {
  orgId: string;
  mimeType: string;
  imageUrl?: string;
  imageBase64?: string;
}

export interface GenerateImageAnalysisTextInput extends AnalyzeImageInput {
  prompt: string;
}

export type AnalyzeImageTagsInput = AnalyzeImageInput;

export interface DetectImageFacesInput extends AnalyzeImageInput {
  imageWidth?: number;
  imageHeight?: number;
}

export interface AnalyzeImageTagsResult {
  provider: AiProviderId;
  modelId: string;
  parsed: Record<string, unknown>;
  tags: string[];
  description?: string;
}

export interface GenerateImageAnalysisTextResult {
  provider: AiProviderId;
  modelId: string;
  text: string;
}

export interface DetectedFace {
  faceHash: string;
  confidence: number;
  boundingBox: { x: number; y: number; w: number; h: number };
  emotion: string;
}

export interface DetectImageFacesResult {
  provider: AiProviderId;
  modelId: string;
  parsed: Record<string, unknown>;
  faces: DetectedFace[];
}

function resolveOpenAiImageSource({ imageBase64, imageUrl, mimeType }: AnalyzeImageInput) {
  if (imageUrl) {
    return imageUrl;
  }

  if (imageBase64) {
    return `data:${mimeType};base64,${imageBase64}`;
  }

  throw new Error('An image URL or base64 payload is required for analysis');
}

function parseImageJsonAnalysis(raw: string) {
  const cleaned = raw
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(cleaned) as Record<string, unknown>;
}

async function runImageJsonAnalysis(
  input: GenerateImageAnalysisTextInput,
) {
  const { modelId, provider, text } = await generateImageAnalysisText(input);

  return {
    provider,
    modelId,
    parsed: parseImageJsonAnalysis(text),
  };
}

export async function generateImageAnalysisText(
  input: GenerateImageAnalysisTextInput,
): Promise<GenerateImageAnalysisTextResult> {
  const aiProviderConfig = await getOrgAiProviderConfig(input.orgId);
  const provider = providerSupportsCapability(aiProviderConfig.provider, 'vision.tag')
    ? aiProviderConfig.provider
    : 'vertex';
  const modelConfig =
    getDefaultModelForProviderCapability(provider, 'analyze')
    ?? getDefaultModelForProviderCapability('vertex', 'analyze');

  if (!modelConfig) {
    throw new Error('No analysis model is configured');
  }

  const text = provider === 'openai'
    ? await generateOpenAiVisionText({
      apiKey: aiProviderConfig.openAiApiKey,
      imageUrl: resolveOpenAiImageSource(input),
      model: modelConfig.modelId,
      orgId: input.orgId,
      prompt: input.prompt,
    })
    : (
      await (await getGeminiFlashImageModel(input.orgId, modelConfig.modelId)).generateContent({
        contents: [
          {
            role: 'user',
            parts: input.imageBase64
              ? [
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.imageBase64,
                  },
                },
                {
                  text: input.prompt,
                },
              ]
              : [
                {
                  fileData: {
                    fileUri: input.imageUrl ?? '',
                    mimeType: input.mimeType,
                  },
                },
                {
                  text: input.prompt,
                },
              ],
          },
        ],
      })
    ).response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  return {
    provider,
    modelId: modelConfig.modelId,
    text,
  };
}

function normalizeParsedTagResult(parsed: Record<string, unknown>) {
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((tag) => String(tag)).filter(Boolean)
    : [];
  const description = typeof parsed.description === 'string'
    ? parsed.description
    : undefined;

  return {
    parsed,
    tags,
    description,
  };
}

export async function analyzeImageTags(
  input: AnalyzeImageTagsInput,
): Promise<AnalyzeImageTagsResult> {
  const { modelId, parsed, provider } = await runImageJsonAnalysis({
    ...input,
    prompt: IMAGE_TAG_ANALYSIS_PROMPT,
  });

  return {
    provider,
    modelId,
    ...normalizeParsedTagResult(parsed),
  };
}

export async function detectImageFaces(
  input: DetectImageFacesInput,
): Promise<DetectImageFacesResult> {
  const imageWidth = input.imageWidth ?? 1000;
  const imageHeight = input.imageHeight ?? 1000;
  const prompt = `Detect all human faces in this image. The image dimensions are ${imageWidth}x${imageHeight}.
Return a JSON object with:
- "faces": array of objects where each face has:
 - "boundingBox": { "x": number, "y": number, "w": number, "h": number } — pixel coordinates from top-left
 - "confidence": number 0-1
 - "emotion": string (one of: "happy", "sad", "neutral", "surprised", "angry", "fearful", "disgusted")
 - "faceHash": a unique short identifier string for this face
If no faces are found, return { "faces": [] }.
Return ONLY valid JSON, no markdown.`;
  const { modelId, parsed, provider } = await runImageJsonAnalysis({
    ...input,
    prompt,
  });
  const faces = Array.isArray(parsed.faces)
    ? parsed.faces.map((face, index) => {
      const rawFace = (face ?? {}) as {
        faceHash?: unknown;
        confidence?: unknown;
        boundingBox?: { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
        emotion?: unknown;
      };
      const emotion = typeof rawFace.emotion === 'string' && FACE_DETECTION_EMOTIONS.has(rawFace.emotion)
        ? rawFace.emotion
        : 'neutral';
      const confidenceValue = typeof rawFace.confidence === 'number' ? rawFace.confidence : 0.8;

      return {
        faceHash:
          typeof rawFace.faceHash === 'string' && rawFace.faceHash.trim()
            ? rawFace.faceHash
            : `face_${index + 1}`,
        confidence: Math.max(0, Math.min(1, confidenceValue)),
        boundingBox: {
          x: typeof rawFace.boundingBox?.x === 'number' ? rawFace.boundingBox.x : 0,
          y: typeof rawFace.boundingBox?.y === 'number' ? rawFace.boundingBox.y : 0,
          w: typeof rawFace.boundingBox?.w === 'number' ? rawFace.boundingBox.w : 0,
          h: typeof rawFace.boundingBox?.h === 'number' ? rawFace.boundingBox.h : 0,
        },
        emotion,
      };
    })
    : [];

  return {
    provider,
    modelId,
    parsed,
    faces,
  };
}