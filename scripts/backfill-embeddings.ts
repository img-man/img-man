// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 9: Backfill existing assets with embeddings, perceptual hash, and dominant colors.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts [--batch-size=50] [--dry-run]
 *
 * Requirements:
 *   - MONGODB_URI env var
 *   - GCP_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS or GCP_APP_CREDENTIALS_PATH
 *
 * This script:
 *   1. Finds all image assets without embeddings
 *   2. Downloads each from GCS
 *   3. Generates embedding via Vertex AI multimodalembedding@001
 *   4. Computes perceptual hash (dHash) and dominant colors via sharp
 *   5. Updates the asset document in MongoDB
 *
 * Non-destructive: only sets new fields, never overwrites existing data.
 */

import path from 'path';

// Set up GCP credentials before any imports that might need them
const credPath =
  process.env.GCP_APP_CREDENTIALS_PATH ||
  path.resolve(
    __dirname,
    '../extra/plasma-raceway-483218-t2-2da94bf2c20d.json',
  );
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg
    ? parseInt(batchSizeArg.split('=')[1], 10)
    : 50;

  console.log(`\n🔄 Sprint 9 — Backfill Asset Intelligence`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Dry run: ${dryRun}\n`);

  // Dynamic imports to avoid top-level side effects
  const { connectToDatabase } = await import('../src/lib/db');
  const { Asset } = await import('../src/models');
  const { generateImageEmbedding } = await import('../src/lib/embeddings');
  const { getGcsBucket } = await import('../src/lib/storage');
  const sharp = (await import('sharp')).default;

  await connectToDatabase();

  // Find image assets missing embeddings (or perceptualHash)
  const query = {
    mimeType: { $regex: /^image\// },
    isDeleted: { $ne: true },
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
      { perceptualHash: { $exists: false } },
      { perceptualHash: null },
    ],
  };

  const totalCount = await Asset.countDocuments(query);
  console.log(`📊 Found ${totalCount} image assets needing backfill\n`);

  if (totalCount === 0 || dryRun) {
    if (dryRun) console.log('🏁 Dry run complete — no changes made.');
    process.exit(0);
  }

  const bucket = getGcsBucket();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Process in batches to control memory and API rate
  while (processed < totalCount) {
    const batch = await Asset.find(query)
      .select('_id storageKey mimeType name')
      .limit(batchSize)
      .lean();

    if (batch.length === 0) break;

    for (const asset of batch) {
      processed++;
      const assetIdStr = (asset._id as unknown as string).toString();

      try {
        // Download from GCS
        let buffer: Buffer;
        try {
          const [buf] = await bucket.file(asset.storageKey).download();
          buffer = buf;
        } catch {
          console.log(
            `  ⏭ ${processed}/${totalCount} — ${asset.name} — GCS download failed, skipping`,
          );
          skipped++;
          // Mark with empty embedding so we don't retry
          await Asset.updateOne(
            { _id: asset._id },
            { $set: { embeddingModel: 'skipped:download-error' } },
          );
          continue;
        }

        const imageBase64 = buffer.toString('base64');

        // Generate embedding + hash + colors in parallel
        const [embeddingResult, hashAndColors] = await Promise.all([
          generateImageEmbedding(imageBase64, asset.mimeType).catch(
            (err: Error) => {
              console.error(`    ⚠ Embedding failed: ${err.message}`);
              return null;
            },
          ),
          extractHashAndColors(sharp, buffer).catch((err: Error) => {
            console.error(`    ⚠ Hash/colors failed: ${err.message}`);
            return null;
          }),
        ]);

        // Build update
        const update: Record<string, unknown> = {};
        if (embeddingResult) {
          update.embedding = embeddingResult.embedding;
          update.embeddingModel = embeddingResult.model;
          update.embeddedAt = embeddingResult.generatedAt;
        }
        if (hashAndColors?.perceptualHash) {
          update.perceptualHash = hashAndColors.perceptualHash;
        }
        if (hashAndColors?.dominantColors?.length) {
          update.dominantColors = hashAndColors.dominantColors;
        }

        if (Object.keys(update).length > 0) {
          await Asset.updateOne({ _id: asset._id }, { $set: update });
          succeeded++;
          const parts = [
            embeddingResult ? 'embedding' : null,
            hashAndColors?.perceptualHash ? 'hash' : null,
            hashAndColors?.dominantColors?.length ? 'colors' : null,
          ]
            .filter(Boolean)
            .join('+');
          console.log(
            `  ✅ ${processed}/${totalCount} — ${asset.name} — ${parts}`,
          );
        } else {
          skipped++;
          console.log(
            `  ⏭ ${processed}/${totalCount} — ${asset.name} — no data generated`,
          );
        }
      } catch (err) {
        failed++;
        console.error(
          `  ❌ ${processed}/${totalCount} — ${asset.name} — ${err instanceof Error ? err.message : err}`,
        );
      }

      // Small delay to avoid rate limiting
      if (processed % 10 === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  console.log(`\n🏁 Backfill complete!`);
  console.log(`   Total: ${processed}`);
  console.log(`   Succeeded: ${succeeded}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}\n`);

  process.exit(0);
}

/**
 * Extract perceptual hash and dominant colors (same logic as confirm route).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractHashAndColors(sharp: any, buffer: Buffer) {
  let perceptualHash: string | null = null;
  try {
    const hashBuffer = await sharp(buffer)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    let hash = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = row * 9 + col;
        hash += hashBuffer[idx] < hashBuffer[idx + 1] ? '1' : '0';
      }
    }
    perceptualHash = '';
    for (let i = 0; i < 64; i += 4) {
      perceptualHash += parseInt(hash.substring(i, i + 4), 2).toString(16);
    }
  } catch {
    // non-fatal
  }

  const dominantColors: string[] = [];
  try {
    const smallBuf = await sharp(buffer)
      .resize(64, 64, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer();

    const colorBuckets = new Map<string, number>();
    for (let i = 0; i < smallBuf.length; i += 3) {
      const r = Math.round(smallBuf[i] / 32) * 32;
      const g = Math.round(smallBuf[i + 1] / 32) * 32;
      const b = Math.round(smallBuf[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    const sorted = [...colorBuckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [rgb] of sorted) {
      const [r, g, b] = rgb.split(',').map(Number);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      dominantColors.push(hex);
    }
  } catch {
    // non-fatal
  }

  return { perceptualHash, dominantColors };
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
