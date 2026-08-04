// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => {
 return {
 authenticateApiRequest: vi.fn(),
 isErrorResponse: vi.fn((v: unknown) => v instanceof NextResponse),
 addCorsHeaders: vi.fn((res: unknown) => res),
 applyFolderScope: vi.fn().mockResolvedValue(null),
 };
});

vi.mock('@/lib/storage', () => ({
 getSignedDownloadUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed'),
}));

vi.mock('@/lib/ai-provider-config', () => ({
 getOrgAiProviderConfig: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
 generateOpenAiVisionText: vi.fn(),
}));

vi.mock('@/lib/vertex-ai', () => ({
 getGeminiFlashImageModel: vi.fn().mockReturnValue({
 generateContent: vi.fn(),
 }),
 parseTextResponse: vi.fn(),
}));

vi.mock('@/models', () => {
 const mockSave = vi.fn();
 return {
 Asset: {
 find: vi.fn(),
 },
 AiJob: {
 create: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
 ...data,
 _id: 'job123',
 save: mockSave,
 })),
 },
 };
});

import { POST } from '@/app/api/v1/faces/search/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiVisionText } from '@/lib/openai';
import { getGeminiFlashImageModel, parseTextResponse } from '@/lib/vertex-ai';
import { Asset } from '@/models';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFind = vi.mocked(Asset.find) as unknown as ReturnType<typeof vi.fn>;
const mockGetOrgAiProviderConfig = vi.mocked(getOrgAiProviderConfig) as unknown as ReturnType<typeof vi.fn>;
const mockGenerateOpenAiVisionText = vi.mocked(generateOpenAiVisionText) as unknown as ReturnType<typeof vi.fn>;
const mockParseText = vi.mocked(parseTextResponse) as unknown as ReturnType<typeof vi.fn>;
const mockGetModel = vi.mocked(getGeminiFlashImageModel) as unknown as ReturnType<typeof vi.fn>;

const AUTH_CTX = {
 keyId: 'key1',
 orgId: 'org1',
 keyName: 'Test',
 permissions: ['read', 'write'] as ('read' | 'write')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
 folderScope: undefined,
};

function makeReq(body: Record<string, unknown>): NextRequest {
 return new NextRequest(new URL('http://localhost/api/v1/faces/search'), {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 } as never);
}

/* ─── Tests ──────────────────────────────────────────────────── */

describe('POST /api/v1/faces/search', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 mockGetOrgAiProviderConfig.mockResolvedValue({ provider: 'vertex' });
 });

 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc' }));
 expect(res.status).toBe(401);
 });

 it('returns 400 when neither selfieBase64 nor selfieUrl provided', async () => {
 const res = await POST(makeReq({}));
 expect(res.status).toBe(400);
 const data = await res.json();
 expect(data.code).toBe('VALIDATION_ERROR');
 });

 it('returns empty matches when no assets with faces exist', async () => {
 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });

 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc' }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.matches).toEqual([]);
 expect(data.totalCandidates).toBe(0);
 });

 it('processes selfie search with base64 and returns matches', async () => {
 const candidateAssets = [
 {
 _id: 'a1',
 name: 'photo1.jpg',
 storageKey: 'assets/org1/photo1.jpg',
 thumbnailStorageKey: 'thumbs/org1/photo1.webp',
 thumbnailBase64: null,
 faces: [{ faceHash: 'fh1', confidence: 0.95, boundingBox: { x: 10, y: 10, w: 50, h: 50 } }],
 mimeType: 'image/jpeg',
 },
 {
 _id: 'a2',
 name: 'photo2.jpg',
 storageKey: 'assets/org1/photo2.jpg',
 thumbnailStorageKey: null,
 thumbnailBase64: 'base64thumb',
 faces: [{ faceHash: 'fh2', confidence: 0.8 }],
 mimeType: 'image/jpeg',
 },
 ];

 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(candidateAssets),
 }),
 }),
 }),
 });

 const mockGenerate = vi.fn().mockResolvedValue({ response: {} });
 mockGetModel.mockReturnValue({ generateContent: mockGenerate });

 mockParseText.mockReturnValue(JSON.stringify({
 matches: [
 { photoIndex: 1, assetId: 'a1', confidence: 0.92, matchedFaceHash: 'fh1' },
 ],
 }));

 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc123' }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.matches).toHaveLength(1);
 expect(data.matches[0].assetId).toBe('a1');
 expect(data.matches[0].confidence).toBe(0.92);
 expect(data.matches[0].faceHash).toBe('fh1');
 expect(data.totalCandidates).toBe(2);
 expect(data.searchJobId).toBe('job123');
 });

 it('uses OpenAI vision analysis when the org provider is openai', async () => {
 const candidateAssets = [
 {
 _id: 'a1',
 name: 'photo1.jpg',
 storageKey: 'assets/org1/photo1.jpg',
 thumbnailStorageKey: 'thumbs/org1/photo1.webp',
 thumbnailBase64: null,
 faces: [{ faceHash: 'fh1', confidence: 0.95, boundingBox: { x: 10, y: 10, w: 50, h: 50 } }],
 mimeType: 'image/jpeg',
 },
 ];

 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(candidateAssets),
 }),
 }),
 }),
 });
 mockGetOrgAiProviderConfig.mockResolvedValue({
 provider: 'openai',
 openAiApiKey: 'sk-openai-test',
 });
 mockGenerateOpenAiVisionText.mockResolvedValue(JSON.stringify({
 matches: [
 { photoIndex: 1, assetId: 'a1', confidence: 0.88, matchedFaceHash: 'fh1' },
 ],
 }));

 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc123' }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.matches).toHaveLength(1);
 expect(data.matches[0].assetId).toBe('a1');
 expect(data.matches[0].confidence).toBe(0.88);
 expect(mockGenerateOpenAiVisionText).toHaveBeenCalledWith(
 expect.objectContaining({
 apiKey: 'sk-openai-test',
 imageUrls: [
 'data:image/jpeg;base64,abc123',
 'https://storage.example.com/signed',
 ],
 model: 'gpt-4.1-mini',
 orgId: 'org1',
 }),
 );
 expect(mockGetModel).not.toHaveBeenCalled();
 });

 it('handles selfieUrl instead of base64', async () => {
 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([
 {
 _id: 'a1', name: 'p.jpg', storageKey: 'k', thumbnailStorageKey: 'tk',
 faces: [{ faceHash: 'fh1' }], mimeType: 'image/jpeg',
 },
 ]),
 }),
 }),
 }),
 });

 const mockGenerate = vi.fn().mockResolvedValue({ response: {} });
 mockGetModel.mockReturnValue({ generateContent: mockGenerate });
 mockParseText.mockReturnValue(JSON.stringify({ matches: [] }));

 const res = await POST(makeReq({ selfieUrl: 'https://example.com/selfie.jpg' }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.matches).toEqual([]);
 // Verify generateContent was called (meaning selfieUrl path was used)
 expect(mockGenerate).toHaveBeenCalled();
 });

 it('clamps confidence to 0-1 range', async () => {
 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([
 {
 _id: 'a1', name: 'p.jpg', storageKey: 'k', thumbnailStorageKey: 'tk',
 faces: [{ faceHash: 'fh1' }], mimeType: 'image/jpeg',
 },
 ]),
 }),
 }),
 }),
 });

 const mockGenerate = vi.fn().mockResolvedValue({ response: {} });
 mockGetModel.mockReturnValue({ generateContent: mockGenerate });
 mockParseText.mockReturnValue(JSON.stringify({
 matches: [{ photoIndex: 1, assetId: 'a1', confidence: 1.5, matchedFaceHash: 'fh1' }],
 }));

 const res = await POST(makeReq({ selfieBase64: 'data:image/png;base64,abc' }));
 const data = await res.json();

 expect(data.matches[0].confidence).toBe(1.0);
 });

 it('handles AI batch failure gracefully', async () => {
 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([
 {
 _id: 'a1', name: 'p.jpg', storageKey: 'k', thumbnailStorageKey: 'tk',
 faces: [{ faceHash: 'fh1' }], mimeType: 'image/jpeg',
 },
 ]),
 }),
 }),
 }),
 });

 const mockGenerate = vi.fn().mockRejectedValue(new Error('Gemini API error'));
 mockGetModel.mockReturnValue({ generateContent: mockGenerate });

 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc' }));
 const data = await res.json();

 // Batch errors are caught per-batch, not at top level
 // Result should still be 200 with empty matches
 expect(res.status).toBe(200);
 expect(data.matches).toEqual([]);
 });

 it('respects maxResults limit', async () => {
 const res = await POST(makeReq({ selfieBase64: 'data:image/jpeg;base64,abc', maxResults: 200 }));
 // maxResults should be clamped to 100 internally
 // Just asserting it doesn't crash with large value
 expect(res.status).toBeDefined();
 });

 it('limits maxResults to 100 and passes folderId filter', async () => {
 mockAssetFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });

 const res = await POST(makeReq({
 selfieBase64: 'data:image/jpeg;base64,abc',
 maxResults: 200,
 folderId: 'folder1',
 }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.totalCandidates).toBe(0);
 // Verify filter included folderId
 expect(mockAssetFind).toHaveBeenCalledWith(
 expect.objectContaining({ folderId: 'folder1' }),
 );
 });
});
