// SPDX-License-Identifier: Apache-2.0
/**
 * Vertex AI client — Gemini 2.5 Flash Image for all AI features.
 *
 * Supports:
 * - Text-only analysis (auto-tag, face-detect) → returns JSON text
 * - Image+text editing (bg-remove, expand, upscale) → returns image
 * - Text-to-image generation → returns image
 */

import { VertexAI } from '@google-cloud/vertexai';
import type { Part, GenerateContentResult } from '@google-cloud/vertexai';
import crypto from 'crypto';
import { buildGoogleAuthOptions, getOrgGcpConfig } from './gcp-config';
import {
 assertAiProviderCapability,
 getDefaultAiModelForCapability,
} from './ai-providers';

type VertexGoogleAuthOptions = NonNullable<
  ConstructorParameters<typeof VertexAI>[0]['googleAuthOptions']
>;

let defaultVertexAI: VertexAI | null = null;
const vertexClients = new Map<string, VertexAI>();

function getProjectId() {
 const projectId = process.env.GCP_PROJECT_ID;

 if (!projectId) {
  throw new Error('Missing GCP_PROJECT_ID in environment variables');
 }

 return projectId;
}

function getLocation() {
 return process.env.GCP_VERTEX_LOCATION || 'us-central1';
}

function getDefaultVertexAiClient() {
 if (defaultVertexAI) {
    return defaultVertexAI;
 }

 defaultVertexAI = new VertexAI({ project: getProjectId(), location: getLocation() });
 return defaultVertexAI;
}

export function getVertexAiClient(): VertexAI;
export function getVertexAiClient(orgId: string): Promise<VertexAI>;
export function getVertexAiClient(orgId?: string) {
 if (!orgId) {
   return getDefaultVertexAiClient();
 }

 return (async () => {
   const orgConfig = await getOrgGcpConfig(orgId);
   const cacheKey = orgConfig.credentialsJson?.trim()
    ? crypto.createHash('sha256').update(orgConfig.credentialsJson.trim()).digest('hex')
    : `default:${orgConfig.projectId}`;

   const cached = vertexClients.get(cacheKey);
   if (cached) {
    return cached;
   }

  const googleAuthOptions = buildGoogleAuthOptions(orgConfig.credentialsJson);
  const vertexGoogleAuthOptions: VertexGoogleAuthOptions | undefined = googleAuthOptions
   ? {
     credentials: googleAuthOptions.credentials,
     projectId: googleAuthOptions.projectId,
     scopes: googleAuthOptions.scopes,
   }
   : undefined;
  const client = vertexGoogleAuthOptions
    ? new VertexAI({
       project: orgConfig.projectId,
       location: getLocation(),
     googleAuthOptions: vertexGoogleAuthOptions,
    })
    : new VertexAI({ project: orgConfig.projectId, location: getLocation() });

   vertexClients.set(cacheKey, client);
   return client;
 })();
}

/* ─── Model Accessors ────────────────────────────────────────── */

/** Gemini 2.5 Flash Image — text analysis (tags, faces, etc.) */
export function getGeminiFlashImageModel(): ReturnType<VertexAI['getGenerativeModel']>;
export function getGeminiFlashImageModel(
 orgId: string,
 modelName?: string,
): Promise<ReturnType<VertexAI['getGenerativeModel']>>;
export function getGeminiFlashImageModel(orgId?: string, modelName?: string) {
 assertAiProviderCapability('vertex', 'vision.tag');
 const resolvedModelName = modelName
  || process.env.GEMINI_IMAGE_MODEL
  || getDefaultAiModelForCapability('vertex', 'vision.tag')
  || 'gemini-2.5-flash-image';
 if (orgId) {
   return (async () =>
    (await getVertexAiClient(orgId)).getGenerativeModel({ model: resolvedModelName }))();
 }

 return getVertexAiClient().getGenerativeModel({ model: resolvedModelName });
}

/** Gemini 2.5 Flash Image — image generation/editing mode */
export function getGeminiImageGenModel(): ReturnType<VertexAI['getGenerativeModel']>;
export function getGeminiImageGenModel(orgId: string, modelName?: string): Promise<ReturnType<VertexAI['getGenerativeModel']>>;
export function getGeminiImageGenModel(orgId?: string, modelName?: string) {
 assertAiProviderCapability('vertex', 'image.generate');
 const resolvedModelName = modelName
  || process.env.GEMINI_IMAGE_MODEL
  || getDefaultAiModelForCapability('vertex', 'image.generate')
  || 'gemini-2.5-flash-image';
 const createModel = (vertexClient: VertexAI) =>
   vertexClient.getGenerativeModel({
    model: resolvedModelName,
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'] as unknown as undefined,
    } as Record<string, unknown>,
   });

 if (orgId) {
   return (async () => createModel(await getVertexAiClient(orgId)))();
 }

 return createModel(getVertexAiClient());
}

/* ─── Response Parsers ───────────────────────────────────────── */

export interface AiImageResult {
 imageData: Buffer; // raw image bytes
 mimeType: string; // e.g. "image/png"
 textResponse?: string;
}

/**
 * Extract the first image (base64 inlineData) from a Gemini response.
 * Also captures any text part.
 */
export function parseImageResponse(
 result: GenerateContentResult,
): AiImageResult | null {
 const candidates = result.response?.candidates;
 if (!candidates?.length) return null;

 let imageData: string | null = null;
 let mimeType = 'image/png';
 let textResponse: string | undefined;

 for (const candidate of candidates) {
 for (const part of candidate.content?.parts ?? []) {
 if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
 imageData = part.inlineData.data as string;
 mimeType = part.inlineData.mimeType;
 }
 if (part.text) {
 textResponse = part.text;
 }
 }
 if (imageData) break;
 }

 if (!imageData) return null;

 return {
 imageData: Buffer.from(imageData, 'base64'),
 mimeType,
 textResponse,
 };
}

/**
 * Parse a text-only Gemini response (strip markdown fences, parse JSON).
 */
export function parseTextResponse(result: GenerateContentResult): string {
 const raw =
 result.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
 return raw
 .replace(/```json?\n?/g, '')
 .replace(/```/g, '')
 .trim();
}

/* ─── Prompt Builders ────────────────────────────────────────── */

/** Build parts array for image+text input */
export function imagePromptParts(
 imageUrl: string,
 imageMimeType: string,
 prompt: string,
): Part[] {
 return [
 { fileData: { fileUri: imageUrl, mimeType: imageMimeType } },
 { text: prompt },
 ];
}

/** Build parts array for text-only input */
export function textPromptParts(prompt: string): Part[] {
 return [{ text: prompt }];
}
