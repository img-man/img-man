// SPDX-License-Identifier: Apache-2.0
/**
 * API Playground — Endpoint definitions and mock response data.
 *
 * Each endpoint group maps to a public API (v1) resource.
 * Mock responses simulate realistic payloads for demo / sandbox use.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface EndpointParam {
 name: string;
 in: 'query' | 'path' | 'header' | 'body';
 type: 'string' | 'number' | 'boolean' | 'object';
 required: boolean;
 description: string;
 default?: string;
 example?: string;
}

export interface EndpointDef {
 id: string;
 method: HttpMethod;
 path: string;
 summary: string;
 description: string;
 params: EndpointParam[];
 sampleBody?: Record<string, unknown>;
 mockResponse: {
 status: number;
 body: Record<string, unknown>;
 headers?: Record<string, string>;
 };
 /** Required API key permission for live mode */
 permission: string;
}

export interface EndpointGroup {
 name: string;
 icon: string; // emoji for simplicity
 description: string;
 endpoints: EndpointDef[];
}

// ─── Mock Data Helpers ──────────────────────────────────────────────────────

const MOCK_ASSET = {
 _id: '6650f1a2b3c4d5e6f7890123',
 filename: 'hero-banner.jpg',
 originalName: 'hero-banner.jpg',
 mimeType: 'image/jpeg',
 size: 245760,
 width: 1920,
 height: 1080,
 format: 'jpeg',
 folder: '6650f1a2b3c4d5e6f7890100',
 tags: ['hero', 'banner', 'homepage'],
 aiTags: ['landscape', 'sky', 'mountain'],
 dominantColors: ['#2563eb', '#f8fafc', '#0f172a'],
 url: 'https://cdn.example.com/ws_abc/hero-banner.jpg',
 cdnUrl: 'https://cdn.example.com/ws_abc/hero-banner.jpg?t=1720000000',
 createdAt: '2024-12-15T10:30:00.000Z',
 updatedAt: '2024-12-15T10:30:00.000Z',
};

const MOCK_FOLDER = {
 _id: '6650f1a2b3c4d5e6f7890100',
 name: 'Marketing',
 slug: 'marketing',
 parent: null,
 path: '/Marketing',
 assetCount: 42,
 createdAt: '2024-12-01T08:00:00.000Z',
 updatedAt: '2024-12-10T14:00:00.000Z',
};

const MOCK_JOB = {
 _id: '6650f1a2b3c4d5e6f7890200',
 type: 'auto-tag',
 status: 'completed',
 assetId: '6650f1a2b3c4d5e6f7890123',
 result: { tags: ['landscape', 'sky', 'mountain', 'nature', 'scenic'] },
 createdAt: '2024-12-15T10:31:00.000Z',
 completedAt: '2024-12-15T10:31:05.000Z',
};

const MOCK_TEAM_MEMBER = {
 _id: '6650f1a2b3c4d5e6f7890300',
 userId: '6650f1a2b3c4d5e6f7890301',
 email: 'designer@example.com',
 name: 'Jane Designer',
 role: 'editor',
 status: 'active',
 joinedAt: '2024-12-05T09:00:00.000Z',
 lastActiveAt: '2024-12-15T11:00:00.000Z',
};

const MOCK_ACCESS_RULE = {
 _id: '6650f1a2b3c4d5e6f7890310',
 memberId: '6650f1a2b3c4d5e6f7890300',
 resource: 'folder',
 resourceId: '6650f1a2b3c4d5e6f7890100',
 permission: 'edit',
 createdAt: '2024-12-06T10:00:00.000Z',
};

const MOCK_SHARE_LINK = {
 _id: '6650f1a2b3c4d5e6f7890400',
 token: 'sk_live_abc123def456',
 targetType: 'folder',
 targetId: '6650f1a2b3c4d5e6f7890100',
 targetName: 'Marketing',
 permission: 'view',
 expiresAt: '2025-03-15T00:00:00.000Z',
 password: false,
 accessCount: 12,
 maxAccess: null,
 active: true,
 createdBy: '6650f1a2b3c4d5e6f7890301',
 createdAt: '2024-12-10T12:00:00.000Z',
};

// ─── Endpoint Groups ────────────────────────────────────────────────────────

export const ENDPOINT_GROUPS: EndpointGroup[] = [
 // ── Assets ─────────────────────────────────────────────
 {
 name: 'Assets',
 icon: '🖼️',
 description: 'Upload, retrieve, update, and delete image assets.',
 endpoints: [
 {
 id: 'list-assets',
 method: 'GET',
 path: '/api/v1/assets',
 summary: 'List assets',
 description:
 'Retrieve a paginated list of assets. Supports filtering by folder, mime type, full-text search, and sorting.',
 params: [
 {
 name: 'page',
 in: 'query',
 type: 'number',
 required: false,
 description: 'Page number (1-based)',
 default: '1',
 example: '1',
 },
 {
 name: 'limit',
 in: 'query',
 type: 'number',
 required: false,
 description: 'Items per page (max 100)',
 default: '20',
 example: '20',
 },
 {
 name: 'folderId',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Filter by folder ID',
 example: '6650f1a2b3c4d5e6f7890100',
 },
 {
 name: 'q',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Full-text search query',
 example: 'hero banner',
 },
 {
 name: 'mimeType',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Prefix filter such as image/ or image/png',
 example: 'image/',
 },
 {
 name: 'sort',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Sort field (createdAt, name, sizeBytes, updatedAt)',
 default: 'createdAt',
 example: 'createdAt',
 },
 {
 name: 'sortDir',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Sort direction (asc or desc)',
 default: 'desc',
 example: 'desc',
 },
 ],
 permission: 'read',
 mockResponse: {
 status: 200,
 body: {
 assets: [
 MOCK_ASSET,
 {
 ...MOCK_ASSET,
 _id: '6650f1a2b3c4d5e6f7890124',
 filename: 'logo-dark.png',
 originalName: 'logo-dark.png',
 mimeType: 'image/png',
 size: 34560,
 width: 512,
 height: 512,
 format: 'png',
 tags: ['logo', 'brand'],
 aiTags: ['graphic', 'logo', 'icon'],
 },
 ],
 total: 42,
 page: 1,
 limit: 20,
 totalPages: 3,
 },
 },
 },
 {
 id: 'asset-transform-url',
 method: 'GET',
 path: '/api/v1/assets/:id/transform',
 summary: 'Get transform URL',
 description:
 'Build a transform URL for an asset using the authenticated helper endpoint.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Asset ID',
 example: '6650f1a2b3c4d5e6f7890123',
 },
 {
 name: 'transforms',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Transform string such as w-400,h-400,q-80,f-webp',
 example: 'w-400,h-400,q-80,f-webp',
 },
 ],
 permission: 'transform',
 mockResponse: {
 status: 200,
 body: {
 url: 'https://example.com/api/transform/acme/w-400,h-400,q-80,f-webp/uploads/acme/hero-banner.jpg',
 assetId: '6650f1a2b3c4d5e6f7890123',
 transforms: 'w-400,h-400,q-80,f-webp',
 },
 },
 },
 {
 id: 'get-asset',
 method: 'GET',
 path: '/api/v1/assets/:id',
 summary: 'Get asset by ID',
 description: 'Retrieve full metadata for a single asset.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Asset ID',
 example: '6650f1a2b3c4d5e6f7890123',
 },
 ],
 permission: 'read',
 mockResponse: { status: 200, body: { asset: MOCK_ASSET } },
 },
 {
 id: 'upload-url',
 method: 'POST',
 path: '/api/v1/assets',
 summary: 'Upload asset from URL',
 description:
 'Ingest an image from a remote URL. The server downloads, processes, and stores the asset.',
 params: [],
 sampleBody: {
 url: 'https://images.unsplash.com/photo-example.jpg',
 folder: '6650f1a2b3c4d5e6f7890100',
 tags: ['imported', 'unsplash'],
 },
 permission: 'write',
 mockResponse: {
 status: 201,
 body: {
 asset: {
 ...MOCK_ASSET,
 _id: '6650f1a2b3c4d5e6f789ffff',
 filename: 'photo-example.jpg',
 tags: ['imported', 'unsplash'],
 },
 },
 },
 },
 {
 id: 'update-asset',
 method: 'PATCH',
 path: '/api/v1/assets/:id',
 summary: 'Update asset metadata',
 description:
 'Update tags, filename, or move the asset to a different folder.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Asset ID',
 example: '6650f1a2b3c4d5e6f7890123',
 },
 ],
 sampleBody: {
 tags: ['hero', 'banner', 'homepage', 'featured'],
 folder: '6650f1a2b3c4d5e6f7890100',
 },
 permission: 'write',
 mockResponse: {
 status: 200,
 body: {
 asset: {
 ...MOCK_ASSET,
 tags: ['hero', 'banner', 'homepage', 'featured'],
 },
 },
 },
 },
 {
 id: 'delete-asset',
 method: 'DELETE',
 path: '/api/v1/assets/:id',
 summary: 'Delete asset',
 description:
 'Permanently delete an asset and its CDN file. This action cannot be undone.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Asset ID',
 example: '6650f1a2b3c4d5e6f7890123',
 },
 ],
 permission: 'delete',
 mockResponse: {
 status: 200,
 body: { success: true, message: 'Asset deleted successfully' },
 },
 },
 ],
 },

 // ── Folders ─────────────────────────────────────────────
 {
 name: 'Folders',
 icon: '📁',
 description: 'Organize assets into a hierarchical folder structure.',
 endpoints: [
 {
 id: 'list-folders',
 method: 'GET',
 path: '/api/v1/folders',
 summary: 'List folders',
 description:
 'Retrieve all folders for the workspace as a flat list. Use `parent` param to get children of a specific folder.',
 params: [
 {
 name: 'parent',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Parent folder ID (null for root)',
 example: '',
 },
 ],
 permission: 'read',
 mockResponse: {
 status: 200,
 body: {
 folders: [
 MOCK_FOLDER,
 {
 ...MOCK_FOLDER,
 _id: '6650f1a2b3c4d5e6f7890101',
 name: 'Engineering',
 slug: 'engineering',
 path: '/Engineering',
 assetCount: 18,
 },
 {
 ...MOCK_FOLDER,
 _id: '6650f1a2b3c4d5e6f7890102',
 name: 'Social Media',
 slug: 'social-media',
 path: '/Marketing/Social Media',
 parent: '6650f1a2b3c4d5e6f7890100',
 assetCount: 12,
 },
 ],
 },
 },
 },
 {
 id: 'create-folder',
 method: 'POST',
 path: '/api/v1/folders',
 summary: 'Create folder',
 description:
 'Create a new folder. Optionally nest under a parent folder.',
 params: [],
 sampleBody: { name: 'Campaign Q1', parent: '6650f1a2b3c4d5e6f7890100' },
 permission: 'write',
 mockResponse: {
 status: 201,
 body: {
 folder: {
 ...MOCK_FOLDER,
 _id: '6650f1a2b3c4d5e6f7890103',
 name: 'Campaign Q1',
 slug: 'campaign-q1',
 path: '/Marketing/Campaign Q1',
 parent: '6650f1a2b3c4d5e6f7890100',
 assetCount: 0,
 },
 },
 },
 },
 {
 id: 'update-folder',
 method: 'PATCH',
 path: '/api/v1/folders/:id',
 summary: 'Rename / move folder',
 description: 'Update folder name or move it to a different parent.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Folder ID',
 example: '6650f1a2b3c4d5e6f7890100',
 },
 ],
 sampleBody: { name: 'Marketing v2' },
 permission: 'write',
 mockResponse: {
 status: 200,
 body: {
 folder: {
 ...MOCK_FOLDER,
 name: 'Marketing v2',
 slug: 'marketing-v2',
 },
 },
 },
 },
 {
 id: 'delete-folder',
 method: 'DELETE',
 path: '/api/v1/folders/:id',
 summary: 'Delete folder',
 description: 'Delete a folder and optionally all assets within it.',
 params: [
 {
 name: 'id',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Folder ID',
 example: '6650f1a2b3c4d5e6f7890100',
 },
 ],
 permission: 'delete',
 mockResponse: {
 status: 200,
 body: { success: true, message: 'Folder deleted successfully' },
 },
 },
 ],
 },

 // ── Upload ─────────────────────────────────────────────
 {
 name: 'Upload',
 icon: '⬆️',
 description: 'Get presigned URLs for direct-to-cloud uploads.',
 endpoints: [
 {
 id: 'presigned-upload',
 method: 'POST',
 path: '/api/v1/upload',
 summary: 'Get presigned upload URL',
 description:
 'Request a presigned GCP Storage URL for direct file upload. After uploading, the asset is automatically processed and indexed.',
 params: [],
 sampleBody: {
 filename: 'product-shot.png',
 contentType: 'image/png',
 folder: '6650f1a2b3c4d5e6f7890100',
 },
 permission: 'write',
 mockResponse: {
 status: 200,
 body: {
 uploadUrl:
 'https://storage.googleapis.com/im-uploads/ws_abc/tmp/product-shot.png?X-Goog-Signature=abc123...',
 assetId: '6650f1a2b3c4d5e6f789aaaa',
 expiresAt: '2024-12-15T11:00:00.000Z',
 },
 },
 },
 ],
 },

 // ── Transforms ─────────────────────────────────────────
 {
 name: 'Transforms',
 icon: '🔄',
 description: 'Generate optimized & transformed image URLs on the fly.',
 endpoints: [
 {
 id: 'get-transform',
 method: 'GET',
 path: '/api/v1/transform',
 summary: 'Get transformed image URL',
 description:
 'Generate a CDN URL with on-the-fly transformations: resize, crop, format conversion, quality adjustment.',
 params: [
 {
 name: 'assetId',
 in: 'query',
 type: 'string',
 required: true,
 description: 'Asset ID to transform',
 example: '6650f1a2b3c4d5e6f7890123',
 },
 {
 name: 'w',
 in: 'query',
 type: 'number',
 required: false,
 description: 'Target width in pixels',
 example: '800',
 },
 {
 name: 'h',
 in: 'query',
 type: 'number',
 required: false,
 description: 'Target height in pixels',
 example: '600',
 },
 {
 name: 'q',
 in: 'query',
 type: 'number',
 required: false,
 description: 'Quality (1-100)',
 default: '80',
 example: '85',
 },
 {
 name: 'f',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Output format (webp, avif, jpeg, png)',
 example: 'webp',
 },
 {
 name: 'fit',
 in: 'query',
 type: 'string',
 required: false,
 description:
 'Resize fit mode (cover, contain, fill, inside, outside)',
 default: 'cover',
 example: 'cover',
 },
 ],
 permission: 'transform',
 mockResponse: {
 status: 200,
 body: {
 url: 'https://cdn.example.com/ws_abc/tr:w-800,h-600,q-85,f-webp/hero-banner.jpg',
 width: 800,
 height: 600,
 format: 'webp',
 estimatedSize: 48200,
 },
 },
 },
 ],
 },

 // ── AI ─────────────────────────────────────────────────
 {
 name: 'AI',
 icon: '✨',
 description:
 'AI-powered image operations: tagging, background removal, upscaling, generation.',
 endpoints: [
 {
 id: 'ai-auto-tag',
 method: 'POST',
 path: '/api/v1/ai',
 summary: 'Auto-tag image',
 description:
 'Analyze an image with Vertex AI Vision to generate descriptive tags automatically.',
 params: [],
 sampleBody: { action: 'auto-tag', assetId: '6650f1a2b3c4d5e6f7890123' },
 permission: 'ai',
 mockResponse: {
 status: 202,
 body: {
 job: {
 ...MOCK_JOB,
 status: 'processing',
 result: null,
 completedAt: null,
 },
 message: 'AI job queued successfully',
 },
 },
 },
 {
 id: 'ai-bg-remove',
 method: 'POST',
 path: '/api/v1/ai',
 summary: 'Remove background',
 description: 'Remove the background of an image using AI segmentation.',
 params: [],
 sampleBody: {
 action: 'bg-remove',
 assetId: '6650f1a2b3c4d5e6f7890123',
 },
 permission: 'ai',
 mockResponse: {
 status: 202,
 body: {
 job: {
 ...MOCK_JOB,
 type: 'bg-remove',
 status: 'processing',
 result: null,
 completedAt: null,
 },
 message: 'Background removal job queued',
 },
 },
 },
 {
 id: 'ai-upscale',
 method: 'POST',
 path: '/api/v1/ai',
 summary: 'Upscale image',
 description:
 'Upscale an image to 2x or 4x resolution using AI super-resolution.',
 params: [],
 sampleBody: {
 action: 'upscale',
 assetId: '6650f1a2b3c4d5e6f7890123',
 scale: 2,
 },
 permission: 'ai',
 mockResponse: {
 status: 202,
 body: {
 job: {
 ...MOCK_JOB,
 type: 'upscale',
 status: 'processing',
 result: null,
 completedAt: null,
 },
 message: 'Upscale job queued',
 },
 },
 },
 {
 id: 'ai-expand',
 method: 'POST',
 path: '/api/v1/ai',
 summary: 'Outpaint / expand image',
 description:
 'Expand an image canvas using AI outpainting (generative fill).',
 params: [],
 sampleBody: {
 action: 'expand',
 assetId: '6650f1a2b3c4d5e6f7890123',
 direction: 'right',
 amount: 256,
 },
 permission: 'ai',
 mockResponse: {
 status: 202,
 body: {
 job: {
 ...MOCK_JOB,
 type: 'expand',
 status: 'processing',
 result: null,
 completedAt: null,
 },
 message: 'Outpaint job queued',
 },
 },
 },
 {
 id: 'ai-generate',
 method: 'POST',
 path: '/api/v1/ai',
 summary: 'Generate image from prompt',
 description:
 'Generate a new image from a text prompt using Vertex AI Imagen.',
 params: [],
 sampleBody: {
 action: 'generate',
 prompt: 'A futuristic cityscape at sunset, digital art',
 width: 1024,
 height: 1024,
 },
 permission: 'ai',
 mockResponse: {
 status: 202,
 body: {
 job: {
 ...MOCK_JOB,
 type: 'generate',
 status: 'processing',
 result: null,
 completedAt: null,
 },
 message: 'Image generation job queued',
 },
 },
 },
 {
 id: 'ai-job-status',
 method: 'GET',
 path: '/api/v1/ai/:jobId',
 summary: 'Get AI job status',
 description:
 'Poll the status of an asynchronous AI job. Returns result when completed.',
 params: [
 {
 name: 'jobId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'AI Job ID',
 example: '6650f1a2b3c4d5e6f7890200',
 },
 ],
 permission: 'ai',
 mockResponse: {
 status: 200,
 body: { job: MOCK_JOB },
 },
 },
 ],
 },

 // ── Teams ──────────────────────────────────────────────
 {
 name: 'Teams',
 icon: '👥',
 description:
 'Manage workspace team members, invitations, roles, and granular access rules.',
 endpoints: [
 {
 id: 'list-members',
 method: 'GET',
 path: '/api/v1/team',
 summary: 'List team members',
 description:
 'Retrieve all team members in the current workspace, including their roles and status.',
 params: [
 {
 name: 'status',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Filter by status (active, pending, suspended)',
 example: 'active',
 },
 {
 name: 'role',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Filter by role (owner, admin, editor, viewer)',
 example: 'editor',
 },
 ],
 permission: 'admin',
 mockResponse: {
 status: 200,
 body: {
 members: [
 MOCK_TEAM_MEMBER,
 {
 ...MOCK_TEAM_MEMBER,
 _id: '6650f1a2b3c4d5e6f7890302',
 email: 'viewer@example.com',
 name: 'Bob Viewer',
 role: 'viewer',
 },
 ],
 total: 2,
 },
 },
 },
 {
 id: 'invite-member',
 method: 'POST',
 path: '/api/v1/team/invite',
 summary: 'Invite a team member',
 description:
 'Send an invitation email to add a new member to the workspace with a specified role.',
 params: [],
 sampleBody: {
 email: 'newuser@example.com',
 role: 'editor',
 message: 'Welcome to the team!',
 },
 permission: 'admin',
 mockResponse: {
 status: 201,
 body: {
 invitation: {
 _id: '6650f1a2b3c4d5e6f7890303',
 email: 'newuser@example.com',
 role: 'editor',
 status: 'pending',
 invitedBy: '6650f1a2b3c4d5e6f7890301',
 expiresAt: '2025-01-15T00:00:00.000Z',
 createdAt: '2024-12-15T12:00:00.000Z',
 },
 message: 'Invitation sent successfully',
 },
 },
 },
 {
 id: 'update-member',
 method: 'PATCH',
 path: '/api/v1/team/:memberId',
 summary: 'Update member role',
 description:
 "Update a team member's role or status. Only admins and owners can modify roles.",
 params: [
 {
 name: 'memberId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Team member ID',
 example: '6650f1a2b3c4d5e6f7890300',
 },
 ],
 sampleBody: { role: 'admin' },
 permission: 'admin',
 mockResponse: {
 status: 200,
 body: {
 member: { ...MOCK_TEAM_MEMBER, role: 'admin' },
 message: 'Member updated',
 },
 },
 },
 {
 id: 'remove-member',
 method: 'DELETE',
 path: '/api/v1/team/:memberId',
 summary: 'Remove team member',
 description:
 'Remove a member from the workspace. Cannot remove the workspace owner.',
 params: [
 {
 name: 'memberId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Team member ID',
 example: '6650f1a2b3c4d5e6f7890300',
 },
 ],
 permission: 'admin',
 mockResponse: {
 status: 200,
 body: { message: 'Member removed from workspace' },
 },
 },
 {
 id: 'add-access-rule',
 method: 'POST',
 path: '/api/v1/team/:memberId/access-rules',
 summary: 'Add access rule',
 description:
 'Create a granular access rule for a team member on a specific folder or asset.',
 params: [
 {
 name: 'memberId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Team member ID',
 example: '6650f1a2b3c4d5e6f7890300',
 },
 ],
 sampleBody: {
 resource: 'folder',
 resourceId: '6650f1a2b3c4d5e6f7890100',
 permission: 'edit',
 },
 permission: 'admin',
 mockResponse: {
 status: 201,
 body: {
 rule: MOCK_ACCESS_RULE,
 message: 'Access rule created',
 },
 },
 },
 {
 id: 'update-access-rule',
 method: 'PUT',
 path: '/api/v1/team/:memberId/access-rules/:ruleId',
 summary: 'Update access rule',
 description: "Modify an existing access rule's permission level.",
 params: [
 {
 name: 'memberId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Team member ID',
 example: '6650f1a2b3c4d5e6f7890300',
 },
 {
 name: 'ruleId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Access rule ID',
 example: '6650f1a2b3c4d5e6f7890310',
 },
 ],
 sampleBody: { permission: 'view' },
 permission: 'admin',
 mockResponse: {
 status: 200,
 body: {
 rule: { ...MOCK_ACCESS_RULE, permission: 'view' },
 message: 'Access rule updated',
 },
 },
 },
 {
 id: 'delete-access-rule',
 method: 'DELETE',
 path: '/api/v1/team/:memberId/access-rules/:ruleId',
 summary: 'Delete access rule',
 description:
 'Remove a granular access rule. The member will fall back to their workspace-level role.',
 params: [
 {
 name: 'memberId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Team member ID',
 example: '6650f1a2b3c4d5e6f7890300',
 },
 {
 name: 'ruleId',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Access rule ID',
 example: '6650f1a2b3c4d5e6f7890310',
 },
 ],
 permission: 'admin',
 mockResponse: {
 status: 200,
 body: { message: 'Access rule deleted' },
 },
 },
 ],
 },

 // ── Sharing ────────────────────────────────────────────
 {
 name: 'Sharing',
 icon: '🔗',
 description:
 'Create and manage share links for assets and folders with optional password protection and expiry.',
 endpoints: [
 {
 id: 'list-share-links',
 method: 'GET',
 path: '/api/v1/share-links',
 summary: 'List share links',
 description:
 'Retrieve all active share links in the workspace. Supports filtering by target type.',
 params: [
 {
 name: 'targetType',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Filter by target type (asset, folder)',
 example: 'folder',
 },
 {
 name: 'active',
 in: 'query',
 type: 'boolean',
 required: false,
 description: 'Filter by active status',
 default: 'true',
 example: 'true',
 },
 ],
 permission: 'share',
 mockResponse: {
 status: 200,
 body: {
 links: [
 MOCK_SHARE_LINK,
 {
 ...MOCK_SHARE_LINK,
 _id: '6650f1a2b3c4d5e6f7890401',
 token: 'sk_live_xyz789ghi012',
 targetType: 'asset',
 targetId: '6650f1a2b3c4d5e6f7890123',
 targetName: 'hero-banner.jpg',
 accessCount: 5,
 },
 ],
 total: 2,
 },
 },
 },
 {
 id: 'create-share-link',
 method: 'POST',
 path: '/api/v1/share',
 summary: 'Create share link',
 description:
 'Generate a new share link for an asset or folder. Optionally set a password, expiry date, and access limit.',
 params: [],
 sampleBody: {
 targetType: 'folder',
 targetId: '6650f1a2b3c4d5e6f7890100',
 permission: 'view',
 expiresAt: '2025-03-15T00:00:00.000Z',
 password: null,
 maxAccess: 100,
 },
 permission: 'share',
 mockResponse: {
 status: 201,
 body: {
 link: MOCK_SHARE_LINK,
 shareUrl: 'https://app.example.com/s/sk_live_abc123def456',
 message: 'Share link created',
 },
 },
 },
 {
 id: 'resolve-share-link',
 method: 'GET',
 path: '/api/v1/share/:token',
 summary: 'Resolve share link',
 description:
 'Resolve a share token to its target resource. Returns shared assets or folder contents. May require a password.',
 params: [
 {
 name: 'token',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Share link token',
 example: 'sk_live_abc123def456',
 },
 {
 name: 'password',
 in: 'query',
 type: 'string',
 required: false,
 description: 'Password if link is protected',
 example: 'secret123',
 },
 ],
 permission: 'read',
 mockResponse: {
 status: 200,
 body: {
 share: {
 targetType: 'folder',
 targetName: 'Marketing',
 permission: 'view',
 assets: [MOCK_ASSET],
 total: 1,
 },
 },
 },
 },
 {
 id: 'revoke-share-link',
 method: 'DELETE',
 path: '/api/v1/share/:token',
 summary: 'Revoke share link',
 description:
 'Permanently deactivate a share link. The link will no longer be accessible.',
 params: [
 {
 name: 'token',
 in: 'path',
 type: 'string',
 required: true,
 description: 'Share link token',
 example: 'sk_live_abc123def456',
 },
 ],
 permission: 'share',
 mockResponse: {
 status: 200,
 body: { message: 'Share link revoked' },
 },
 },
 ],
 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string }> = {
 GET: {
 bg: 'bg-emerald-100 dark:bg-emerald-900/40',
 text: 'text-emerald-700 dark:text-emerald-400',
 },
 POST: {
 bg: 'bg-blue-100 dark:bg-blue-900/40',
 text: 'text-blue-700 dark:text-blue-400',
 },
 PATCH: {
 bg: 'bg-amber-100 dark:bg-amber-900/40',
 text: 'text-amber-700 dark:text-amber-400',
 },
 PUT: {
 bg: 'bg-orange-100 dark:bg-orange-900/40',
 text: 'text-orange-700 dark:text-orange-400',
 },
 DELETE: {
 bg: 'bg-red-100 dark:bg-red-900/40',
 text: 'text-red-700 dark:text-red-400',
 },
};

export function getAllEndpoints(): EndpointDef[] {
 return ENDPOINT_GROUPS.flatMap((g) => g.endpoints);
}
