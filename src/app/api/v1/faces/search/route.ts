// SPDX-License-Identifier: Apache-2.0
/**
 * POST /api/v1/faces/search — Search for a person across assets using a selfie
 *
 * The caller uploads a selfie (base64 or URL). img-man uses the active org AI provider to:
 * 1. Detect the face in the selfie
 * 2. Compare it against face thumbnails from stored assets
 * 3. Return matching assets with confidence scores
 *
 * This uses provider-backed visual comparison — not vector embeddings.
 * The approach: send the selfie + a batch of asset thumbnails to the active provider,
 * ask which ones contain the same person.
 *
 * Auth: API Key (read)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { getDefaultModelForProviderCapability } from '@/lib/ai-models';
import { generateOpenAiVisionText } from '@/lib/openai';
import { providerSupportsCapability } from '@/lib/ai-providers';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders, applyFolderScope } from '@/lib/api-auth';
import { Asset, AiJob } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';
import { getGeminiFlashImageModel, parseTextResponse } from '@/lib/vertex-ai';
import type { Part } from '@google-cloud/vertexai';

function cleanFaceSearchJson(raw: string) {
 return raw
 .replace(/```json?\n?/g, '')
 .replace(/```/g, '')
 .trim();
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * POST /api/v1/faces/search
 *
 * Body (JSON):
 * - selfieBase64: string — Base64-encoded selfie image (data:image/jpeg;base64,...)
 * - selfieUrl?: string — OR a URL to the selfie image
 * - maxResults?: number — Maximum results to return (default: 50, max: 100)
 * - folderId?: string — Restrict search to a specific folder
 *
 * Returns:
 * - matches[]: { assetId, name, url, thumbnailUrl, confidence, faceHash, boundingBox }
 * - totalCandidates: number — How many assets with faces were checked
 * - searchJobId: string — AI job ID for tracking
 */
export async function POST(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const body = await req.json();
 const { selfieBase64, selfieUrl, maxResults = 50, folderId } = body;

 if (!selfieBase64 && !selfieUrl) {
 const res = NextResponse.json(
 { error: 'Either selfieBase64 or selfieUrl is required', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 const resultLimit = Math.min(100, Math.max(1, maxResults));

 // Build filter for assets with detected faces
 const matchFilter: Record<string, unknown> = {
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 'faces.0': { $exists: true },
 };

 if (folderId) {
 matchFilter.folderId = folderId;
 }

 // Apply folder scope
 const scopeError = await applyFolderScope(auth, matchFilter, 'asset');
 if (scopeError) return scopeError;

 // Fetch all assets with faces (limited to 500 for performance)
 const candidateAssets = await Asset.find(matchFilter)
 .select('_id name storageKey thumbnailStorageKey thumbnailBase64 faces mimeType')
 .sort({ createdAt: -1 })
 .limit(500)
 .lean();

 if (candidateAssets.length === 0) {
 const res = NextResponse.json({
 matches: [],
 totalCandidates: 0,
 message: 'No assets with detected faces found',
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Create AI job for tracking
 const job = await AiJob.create({
 orgId: auth.orgId,
 userId: `api:${auth.orgId}`,
 type: 'face_detect',
 status: 'processing',
 startedAt: new Date(),
 input: {
 operation: 'face_search',
 candidateCount: candidateAssets.length,
 },
 });

try {
 const aiProviderConfig = await getOrgAiProviderConfig(auth.orgId);
 const activeAnalysisProvider = providerSupportsCapability(aiProviderConfig.provider, 'vision.tag')
 ? aiProviderConfig.provider
 : 'vertex';
 const modelConfig =
 getDefaultModelForProviderCapability(activeAnalysisProvider, 'analyze')
 ?? getDefaultModelForProviderCapability('vertex', 'analyze');

 if (!modelConfig) {
 throw new Error('No analysis model is configured');
 }

 // Prepare selfie image source for the active provider
 let selfiePart: Part;
 let openAiSelfieUrl: string;
 if (selfieBase64) {
 // Strip data URL prefix if present
 const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
 const mimeMatch = selfieBase64.match(/^data:(image\/\w+);base64,/);
 const selfieMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
 openAiSelfieUrl = `data:${selfieMime};base64,${base64Data}`;
 selfiePart = {
 inlineData: { data: base64Data, mimeType: selfieMime },
 };
 } else {
 openAiSelfieUrl = selfieUrl!;
 selfiePart = {
 fileData: { fileUri: selfieUrl!, mimeType: 'image/jpeg' },
 };
 }

 // Process candidates in batches of 10
 // For each batch, send selfie + candidate thumbnails to Gemini
 const BATCH_SIZE = 10;
 const allMatches: {
 assetId: string;
 name: string;
 confidence: number;
 faceHash: string;
 boundingBox?: { x: number; y: number; w: number; h: number };
 }[] = [];

 for (let i = 0; i < candidateAssets.length; i += BATCH_SIZE) {
 const batch = candidateAssets.slice(i, i + BATCH_SIZE);

 // Build a description of candidates for Gemini
 const candidateDescriptions = batch.map((asset, idx) => {
 const faces = asset.faces || [];
 return `Photo ${idx + 1} (ID: ${String(asset._id)}): Contains ${faces.length} face(s) with hashes: ${faces.map((f: { faceHash: string }) => f.faceHash).join(', ')}`;
 }).join('\n');

 // Get signed URLs for candidate thumbnails
 const candidateParts: Part[] = [];
 const openAiCandidateUrls: string[] = [];
 for (const asset of batch) {
 try {
 const thumbKey = asset.thumbnailStorageKey || asset.storageKey;
 const thumbUrl = await getSignedDownloadUrl(thumbKey, 60 * 5, undefined, auth.orgId);
 openAiCandidateUrls.push(thumbUrl);
 candidateParts.push({
 fileData: { fileUri: thumbUrl, mimeType: 'image/webp' },
 });
 } catch {
 // Skip assets we can't load
 candidateParts.push({ text: `[Photo unavailable]` });
 }
 }
 const prompt = `I have a selfie photo (the first image) and ${batch.length} candidate photos (the remaining images).

For each candidate photo, determine if the person in the selfie appears in that photo. Consider face shape, eyes, nose, mouth, and overall appearance.

Candidate details:
${candidateDescriptions}

Return a JSON object with:
{
 "matches": [
 {
 "photoIndex": <1-based index of the matching photo>,
 "assetId": "<the ID from the candidate details>",
 "confidence": <0.0 to 1.0>,
 "matchedFaceHash": "<faceHash of the matched face from the details>"
 }
 ]
}

Only include matches with confidence >= 0.5. If no matches, return {"matches": []}.
Return ONLY valid JSON, no markdown.`;

 try {
 const raw = activeAnalysisProvider === 'openai'
 ? await generateOpenAiVisionText({
 apiKey: aiProviderConfig.openAiApiKey,
 imageUrls: [openAiSelfieUrl, ...openAiCandidateUrls],
 model: modelConfig.modelId,
 orgId: auth.orgId,
 prompt,
 })
 : parseTextResponse(
 await (await getGeminiFlashImageModel(auth.orgId, modelConfig.modelId)).generateContent({
 contents: [{
 role: 'user',
 parts: [
 selfiePart,
 ...candidateParts,
 { text: prompt },
 ],
 }],
 }),
 );

 const parsed = JSON.parse(cleanFaceSearchJson(raw));

 if (Array.isArray(parsed.matches)) {
 for (const match of parsed.matches) {
 const photoIdx = (match.photoIndex || 1) - 1;
 const asset = batch[photoIdx];
 if (!asset) continue;

 const matchedFace = asset.faces?.find(
 (f: { faceHash: string }) => f.faceHash === match.matchedFaceHash,
 );

 allMatches.push({
 assetId: String(asset._id),
 name: asset.name,
 confidence: Math.max(0, Math.min(1, match.confidence ?? 0.5)),
 faceHash: match.matchedFaceHash || matchedFace?.faceHash || 'unknown',
 boundingBox: matchedFace?.boundingBox,
 });
 }
 }
 } catch (batchErr) {
 console.error(`[FaceSearch] Batch ${i / BATCH_SIZE + 1} failed:`, batchErr);
 // Continue with next batch
 }

 // Stop early if we have enough matches
 if (allMatches.length >= resultLimit) break;
 }

 // Sort by confidence descending and limit results
 allMatches.sort((a, b) => b.confidence - a.confidence);
 const topMatches = allMatches.slice(0, resultLimit);

 // Enrich with signed download URLs
 const enrichedMatches = await Promise.all(
 topMatches.map(async (match) => {
 const asset = candidateAssets.find(
 (a) => String(a._id) === match.assetId,
 );
 let url: string | null = null;
 let thumbnailUrl: string | null = null;

 if (asset) {
 try {
 url = await getSignedDownloadUrl(asset.storageKey, 3600, undefined, auth.orgId);
 if (asset.thumbnailStorageKey) {
 thumbnailUrl = await getSignedDownloadUrl(asset.thumbnailStorageKey, 3600, undefined, auth.orgId);
 }
 } catch {
 // URL generation failed
 }
 }

 return {
 ...match,
 url,
 thumbnailUrl: thumbnailUrl || asset?.thumbnailBase64 || url,
 };
 }),
 );

 // Update job status
 job.status = 'completed';
 job.result = {
 matchCount: enrichedMatches.length,
 totalCandidates: candidateAssets.length,
 };
 job.completedAt = new Date();
 await job.save();

 const res = NextResponse.json({
 matches: enrichedMatches,
 totalCandidates: candidateAssets.length,
 searchJobId: String(job._id),
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 } catch (err) {
 job.status = 'failed';
 job.error = err instanceof Error ? err.message : String(err);
 job.completedAt = new Date();
 await job.save();

 const res = NextResponse.json(
 { error: 'Face search failed', details: job.error },
 { status: 500 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
}
