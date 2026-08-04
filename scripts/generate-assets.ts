// SPDX-License-Identifier: Apache-2.0
/**
 * Generate hero assets using Vertex AI Imagen.
 *
 * Usage:
 *   npx tsx scripts/generate-assets.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
 *     OR GCP_APP_CREDENTIALS_PATH set in .env
 *   - GCP_PROJECT_ID and GCP_VERTEX_LOCATION in .env
 *   - The service account needs aiplatform.endpoints.predict permission
 *
 * The script calls Vertex AI's Imagen model to generate a hero image
 * and saves it to public/assets/hero-3d.png.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { VertexAI } from '@google-cloud/vertexai';

// ─── Config ────────────────────────────────────────────────────────
const PROJECT_ID = process.env.GCP_PROJECT_ID ?? '';
const LOCATION = process.env.GCP_VERTEX_LOCATION ?? 'us-central1';
const MODEL = 'imagen-3.0-generate-002'; // Imagen 3 generation model

if (!PROJECT_ID) {
  console.error('❌  Missing GCP_PROJECT_ID in .env');
  process.exit(1);
}

// Set credentials path if not already set globally
if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  process.env.GCP_APP_CREDENTIALS_PATH
) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    process.env.GCP_APP_CREDENTIALS_PATH,
  );
}

const OUTPUT_DIR = path.resolve('public/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'hero-3d.png');

// ─── Prompts ───────────────────────────────────────────────────────
const HERO_PROMPT =
  'Abstract 3D glass layers, deep purple and obsidian lighting, isometric view, high tech, minimal, 8k render.';

// ─── Main ──────────────────────────────────────────────────────────
async function generateHeroAssets(): Promise<void> {
  console.log('🎨  Initializing Vertex AI …');
  console.log(`   Project : ${PROJECT_ID}`);
  console.log(`   Location: ${LOCATION}`);
  console.log(`   Model   : ${MODEL}`);
  console.log(`   Prompt  : "${HERO_PROMPT}"`);
  console.log();

  const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

  const generativeModel = vertexAI.getGenerativeModel({
    model: MODEL,
  });

  console.log('🖼️   Generating image …');
  const response = await generativeModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: HERO_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'] as unknown as undefined,
    } as Record<string, unknown>,
  });

  const candidates = response.response?.candidates;
  if (!candidates || candidates.length === 0) {
    console.error('❌  No candidates returned from the model.');
    console.error(
      '   Full response:',
      JSON.stringify(response.response, null, 2),
    );
    process.exit(1);
  }

  // Find the image part in the response
  let imageData: string | null = null;
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        imageData = part.inlineData.data as string;
        break;
      }
    }
    if (imageData) break;
  }

  if (!imageData) {
    console.error('❌  No image data found in response.');
    console.error(
      '   Parts:',
      JSON.stringify(
        candidates.map((c) => c.content?.parts?.map((p) => Object.keys(p))),
        null,
        2,
      ),
    );
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Decode base64 and write to file
  const buffer = Buffer.from(imageData, 'base64');
  fs.writeFileSync(OUTPUT_FILE, buffer);

  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log(`✅  Saved hero image → ${OUTPUT_FILE}  (${sizeKB} KB)`);
}

// ─── Run ───────────────────────────────────────────────────────────
generateHeroAssets().catch((err) => {
  console.error('❌  Generation failed:', err.message ?? err);
  if (err.response?.data) {
    console.error(
      '   API response:',
      JSON.stringify(err.response.data, null, 2),
    );
  }
  process.exit(1);
});
