// SPDX-License-Identifier: Apache-2.0
/**
 * Vertex AI Multimodal Embedding utility.
 *
 * Uses the `multimodalembedding@001` model via REST API to generate
 * 768-dimensional float vectors for images and text queries.
 *
 * These embeddings power:
 * - Semantic search ("find a happy dog")
 * - Visual similarity ("find similar images")
 * - Cross-modal retrieval (text → image, image → image)
 */

import { GoogleAuth } from 'google-auth-library';
import crypto from 'crypto';
import { buildGoogleAuthOptions, getOrgGcpConfig } from './gcp-config';
import {
  assertAiProviderCapability,
  getDefaultAiModelForCapability,
} from './ai-providers';

/* ─── Configuration ────────────────────────────────────────── */

const LOCATION = process.env.GCP_VERTEX_LOCATION || 'us-central1';
const EMBEDDING_MODEL =
  getDefaultAiModelForCapability('vertex', 'vision.embed') ?? 'multimodalembedding@001';
const EMBEDDING_DIMENSIONS = 768;

/** Max image size for embedding API (20 MB) */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/* ─── Auth Client ──────────────────────────────────────────── */

let authClient: GoogleAuth | null = null;
const authClients = new Map<string, GoogleAuth>();

function getDefaultAuthClient(): GoogleAuth {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  return authClient;
}

async function getAuthClient(orgId?: string): Promise<GoogleAuth> {
  if (!orgId) {
    return getDefaultAuthClient();
  }

  const orgConfig = await getOrgGcpConfig(orgId);
  const cacheKey = orgConfig.credentialsJson?.trim()
    ? crypto.createHash('sha256').update(orgConfig.credentialsJson.trim()).digest('hex')
    : `default:${orgConfig.projectId}`;

  const cached = authClients.get(cacheKey);
  if (cached) {
    return cached;
  }

  const authOptions = buildGoogleAuthOptions(orgConfig.credentialsJson) ?? {};
  const client = new GoogleAuth({
    ...authOptions,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  authClients.set(cacheKey, client);
  return client;
}

/**
 * Get a valid access token for Vertex AI API calls.
 * Caches and auto-refreshes via google-auth-library.
 */
async function getAccessToken(orgId?: string): Promise<string> {
  const auth = await getAuthClient(orgId);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token)
    throw new Error('Failed to obtain GCP access token for embeddings');
  return token;
}

/* ─── Prediction Endpoint ──────────────────────────────────── */

async function getPredictionUrl(orgId?: string): Promise<string> {
  const orgConfig = await getOrgGcpConfig(orgId);
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${orgConfig.projectId}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;
}

/* ─── Types ────────────────────────────────────────────────── */

export interface EmbeddingResult {
  /** 768-dimensional float vector */
  embedding: number[];
  /** Model used to generate the embedding */
  model: string;
  /** Timestamp of generation */
  generatedAt: Date;
}

interface PredictionResponse {
  predictions?: Array<{
    imageEmbedding?: number[];
    textEmbedding?: number[];
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/* ─── Core Functions ───────────────────────────────────────── */

/**
 * Generate a 768-dim embedding for an image (base64-encoded).
 *
 * @param imageBase64 - Raw base64 string of the image (no data: prefix)
 * @param mimeType    - e.g. "image/jpeg", "image/png", "image/webp"
 * @returns EmbeddingResult with the 768-dim vector
 * @throws On API errors, auth failures, or oversized images
 */
export async function generateImageEmbedding(
  imageBase64: string,
  mimeType: string,
  orgId?: string,
): Promise<EmbeddingResult> {
  assertAiProviderCapability('vertex', 'vision.embed');
  // Validate size (base64 is ~33% larger than raw, so approximate)
  const approxBytes = (imageBase64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large for embedding (${(approxBytes / 1024 / 1024).toFixed(1)}MB, max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`,
    );
  }

  const token = await getAccessToken(orgId);
  const url = await getPredictionUrl(orgId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [
        {
          image: {
            bytesBase64Encoded: imageBase64,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Vertex AI embedding API error (${response.status}): ${errText}`,
    );
  }

  const data = (await response.json()) as PredictionResponse;

  if (data.error) {
    throw new Error(
      `Vertex AI embedding error: ${data.error.message} (${data.error.status})`,
    );
  }

  const embedding = data.predictions?.[0]?.imageEmbedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding response: expected ${EMBEDDING_DIMENSIONS}-dim vector, got ${embedding?.length ?? 'none'}`,
    );
  }

  return {
    embedding,
    model: EMBEDDING_MODEL,
    generatedAt: new Date(),
  };
}

/**
 * Generate a 768-dim embedding for a text query.
 * Used for semantic search: user query → text embedding → cosine similarity vs image embeddings.
 *
 * @param text - The search query or description (max ~1024 tokens)
 * @returns EmbeddingResult with the 768-dim vector
 */
export async function generateTextEmbedding(
  text: string,
  orgId?: string,
): Promise<EmbeddingResult> {
  assertAiProviderCapability('vertex', 'vision.embed');
  if (!text.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const token = await getAccessToken(orgId);
  const url = await getPredictionUrl(orgId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [
        {
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Vertex AI text embedding API error (${response.status}): ${errText}`,
    );
  }

  const data = (await response.json()) as PredictionResponse;

  if (data.error) {
    throw new Error(
      `Vertex AI text embedding error: ${data.error.message} (${data.error.status})`,
    );
  }

  const embedding = data.predictions?.[0]?.textEmbedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid text embedding response: expected ${EMBEDDING_DIMENSIONS}-dim vector, got ${embedding?.length ?? 'none'}`,
    );
  }

  return {
    embedding,
    model: EMBEDDING_MODEL,
    generatedAt: new Date(),
  };
}

/**
 * Generate embeddings for both image and text in a single API call.
 * More efficient when you need both (e.g., on upload with description).
 *
 * @param imageBase64 - Raw base64 of the image
 * @param mimeType    - e.g. "image/jpeg"
 * @param text        - Additional text context (tags, description)
 * @returns Object with separate image and text embeddings
 */
export async function generateMultimodalEmbedding(
  imageBase64: string,
  mimeType: string,
  text: string,
  orgId?: string,
): Promise<{ image: EmbeddingResult; text: EmbeddingResult }> {
  assertAiProviderCapability('vertex', 'vision.embed');
  const approxBytes = (imageBase64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large for embedding (${(approxBytes / 1024 / 1024).toFixed(1)}MB, max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`,
    );
  }

  const token = await getAccessToken(orgId);
  const url = await getPredictionUrl(orgId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [
        {
          image: { bytesBase64Encoded: imageBase64 },
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Vertex AI multimodal embedding API error (${response.status}): ${errText}`,
    );
  }

  const data = (await response.json()) as PredictionResponse;

  if (data.error) {
    throw new Error(
      `Vertex AI multimodal embedding error: ${data.error.message} (${data.error.status})`,
    );
  }

  const pred = data.predictions?.[0];
  const imageEmbedding = pred?.imageEmbedding;
  const textEmbedding = pred?.textEmbedding;

  if (!imageEmbedding || imageEmbedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error('Invalid image embedding in multimodal response');
  }
  if (!textEmbedding || textEmbedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error('Invalid text embedding in multimodal response');
  }

  const now = new Date();
  return {
    image: {
      embedding: imageEmbedding,
      model: EMBEDDING_MODEL,
      generatedAt: now,
    },
    text: {
      embedding: textEmbedding,
      model: EMBEDDING_MODEL,
      generatedAt: now,
    },
  };
}

/* ─── Similarity Helpers ───────────────────────────────────── */

/**
 * Compute cosine similarity between two vectors (for in-memory comparisons).
 * MongoDB Atlas Vector Search handles this server-side for queries,
 * but this is useful for client-side ranking or testing.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/* ─── Constants Export ─────────────────────────────────────── */

export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  maxImageBytes: MAX_IMAGE_BYTES,
} as const;
