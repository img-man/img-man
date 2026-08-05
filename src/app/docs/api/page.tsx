// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import {
 BookOpen,
 ChevronRight,
 Key,
 FileImage,
 FolderOpen,
 Sparkles,
 Upload,
 ArrowRightLeft,
 Copy,
 Check,
 Users,
 Share2,
 ScanFace,
} from 'lucide-react';

interface Endpoint {
 method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
 path: string;
 description: string;
 permission: string;
 body?: Record<string, string>;
 query?: Record<string, string>;
 response: string;
}

const ENDPOINTS: Record<string, Endpoint[]> = {
 Assets: [
 {
 method: 'GET',
 path: '/api/v1/assets',
 description: 'List all assets with pagination, search, and filters.',
 permission: 'read',
 query: {
 page: 'Page number (default: 1)',
 limit: 'Items per page (default: 30, max: 100)',
 q: 'Full-text search query',
 folderId: 'Filter by folder ID',
 mimeType: 'Filter by MIME type prefix (e.g. "image")',
 sort: 'Sort field: createdAt, name, sizeBytes, updatedAt',
 sortDir: 'Sort direction: asc or desc',
 },
 response: `{
 "assets": [
 {
 "_id": "...",
 "name": "hero.png",
 "mimeType": "image/png",
 "width": 1920, "height": 1080,
 "sizeBytes": 524288,
 "url": "https://storage.googleapis.com/...",
 "tags": ["hero", "banner"],
 "createdAt": "2026-01-15T..."
 }
 ],
 "total": 42, "page": 1, "totalPages": 2
}`,
 },
 {
 method: 'POST',
 path: '/api/v1/assets',
 description:
 'Create an asset. Pass a URL to import, or get a signed upload URL.',
 permission: 'write',
 body: {
 name: '(required) File name',
 contentType: 'MIME type (e.g. "image/png")',
 sizeBytes: 'File size in bytes',
 url: '(optional) URL to import image from',
 folderId: '(optional) Target folder ID',
 tags: '(optional) Array of tag strings',
 },
 response: `// Import from URL:
{ "asset": { "_id": "...", "url": "..." } }
// Direct upload:
{ "assetId": "...", "uploadUrl": "https://storage...", "storageKey": "...", "url": "https://storage...", "publicUrl": "https://app.imageman.io/i/<id>" }`,
 },
 {
 method: 'GET',
 path: '/api/v1/assets/:id',
 description: 'Get a single asset with full metadata and signed URLs.',
 permission: 'read',
 response: `{ "asset": { "_id": "...", "name": "hero.png", "url": "...", "tags": [], "variants": [] } }`,
 },
 {
 method: 'PATCH',
 path: '/api/v1/assets/:id',
 description: 'Update asset metadata, tags, or folder.',
 permission: 'write',
 body: {
 name: '(optional) New name',
 tags: '(optional) Replace tags array',
 folderId: '(optional) Move to folder',
 },
 response: `{ "asset": { "_id": "...", "name": "Updated" } }`,
 },
 {
 method: 'DELETE',
 path: '/api/v1/assets/:id',
 description: 'Soft-delete an asset.',
 permission: 'delete',
 response: `{ "message": "Asset deleted", "id": "..." }`,
 },
 ],
 Transforms: [
 {
 method: 'GET',
 path: '/api/v1/assets/:id/transform',
 description:
 'Get a transform URL for an asset. Pass a transform string as query parameter.',
 permission: 'transform',
 query: {
 transforms: 'Transform string (e.g. "w-300,h-300,q-80,f-webp")',
 },
 response: `{ "url": "https://your-domain/api/transform/...", "transforms": "w-300,h-300" }`,
 },
 {
 method: 'POST',
 path: '/api/v1/transforms/ai',
 description:
 'Generate a transform string from natural language using AI (Gemini).',
 permission: 'ai',
 body: {
 prompt:
 '(required) Natural language description, e.g. "make a 400x400 thumbnail"',
 },
 response: `{ "transform": "w-400,h-400,c-thumb,g-auto,q-80,f-webp", "source": "ai" }`,
 },
 ],
 Folders: [
 {
 method: 'GET',
 path: '/api/v1/folders',
 description: 'List folders.',
 permission: 'read',
 query: { parentId: 'Parent folder ID (null for root)' },
 response: `{ "folders": [{ "_id": "...", "name": "Products", "path": "/Products" }] }`,
 },
 {
 method: 'POST',
 path: '/api/v1/folders',
 description: 'Create a new folder.',
 permission: 'write',
 body: {
 name: '(required) Folder name',
 parentId: '(optional) Parent folder ID',
 },
 response: `{ "folder": { "_id": "...", "name": "Banners" } }`,
 },
 {
 method: 'PATCH',
 path: '/api/v1/folders/:id',
 description: 'Rename or move a folder.',
 permission: 'write',
 body: {
 name: '(optional) New name',
 parentId: '(optional) New parent folder ID',
 },
 response: `{ "folder": { ... } }`,
 },
 {
 method: 'DELETE',
 path: '/api/v1/folders/:id',
 description: 'Delete an empty folder.',
 permission: 'write',
 response: `{ "message": "Folder deleted" }`,
 },
 ],
 Upload: [
 {
 method: 'POST',
 path: '/api/v1/upload/signed-url',
 description:
 'Get a presigned upload URL for direct browser-to-GCS upload.',
 permission: 'write',
 body: {
 fileName: '(required)',
 contentType: '(required)',
 sizeBytes: '(optional)',
 },
 response: `{ "uploadUrl": "https://storage...", "assetId": "...", "storageKey": "...", "url": "https://storage...", "publicUrl": "https://app.imageman.io/i/<id>" }

// publicUrl is the stable, img-man-domain link. It 302-redirects to a fresh
// signed GCS URL. Append transform params (?w=400&h=300&format=webp&q=85)
// to get a resized variant on the fly.`,
 },
 ],
 Teams: [
 {
 method: 'GET',
 path: '/api/v1/team',
 description:
 'List all team members with roles, status, and access rules.',
 permission: 'admin',
 query: {
 page: 'Page number (default: 1)',
 limit: 'Items per page (default: 50, max: 100)',
 },
 response: `{
 "members": [{
 "id": "...", "email": "user@example.com", "role": "editor",
 "status": "active", "name": "John", "accessRules": [
 { "path": "/Products", "role": "editor", "resourceType": "folder" }
 ]
 }],
 "folders": [{ "id": "...", "name": "Products", "path": "/Products" }],
 "total": 5, "page": 1, "totalPages": 1
}`,
 },
 {
 method: 'POST',
 path: '/api/v1/team/invite',
 description:
 'Invite a new team member. Requires at least name + email or phone.',
 permission: 'admin',
 body: {
 name: '(required) Member name',
 email: '(optional) Email — at least email or phone required',
 phone: '(optional) Phone — at least email or phone required',
 role: '(required) "admin" | "editor" | "viewer"',
 accessRules: '(optional) Array of { path, role, resourceType }',
 },
 response: `{
 "membership": {
 "id": "...", "name": "John", "email": "john@example.com",
 "role": "editor", "status": "active",
 "accessRules": [{ "path": "/", "role": "editor", "resourceType": "folder" }]
 }
}`,
 },
 {
 method: 'PATCH',
 path: '/api/v1/team/:memberId',
 description: "Update a member's role, folder access, or access rules.",
 permission: 'admin',
 body: {
 role: '(optional) "admin" | "editor" | "viewer"',
 accessRules: '(optional) Array of { path, role, resourceType }',
 folderAccess: '(optional) Array of folder IDs (legacy)',
 },
 response: `{ "success": true, "memberId": "...", "newRole": "editor" }`,
 },
 {
 method: 'DELETE',
 path: '/api/v1/team/:memberId',
 description: 'Remove a team member.',
 permission: 'admin',
 response: `{ "success": true, "memberId": "..." }`,
 },
 {
 method: 'POST',
 path: '/api/v1/team/:memberId/access-rules',
 description: 'Add a granular access rule for a team member.',
 permission: 'admin',
 body: {
 path: '(required) Resource path (e.g. "/Products")',
 role: '(required) "owner" | "admin" | "editor" | "viewer"',
 resourceType: '(required) "folder" | "asset"',
 },
 response: `{ "success": true, "memberId": "...", "accessRules": [...] }`,
 },
 {
 method: 'PUT',
 path: '/api/v1/team/:memberId/access-rules',
 description: 'Update an existing access rule.',
 permission: 'admin',
 body: {
 oldPath: '(required) Current path',
 newPath: '(required) New path',
 newRole: '(required) "owner" | "admin" | "editor" | "viewer"',
 newResourceType: '(required) "folder" | "asset"',
 },
 response: `{ "success": true, "memberId": "...", "accessRules": [...] }`,
 },
 {
 method: 'DELETE',
 path: '/api/v1/team/:memberId/access-rules',
 description: 'Remove an access rule from a team member.',
 permission: 'admin',
 body: {
 path: '(required) Resource path to remove',
 resourceType: '(optional) "folder" | "asset"',
 },
 response: `{ "success": true, "memberId": "...", "accessRules": [...] }`,
 },
 ],
 Sharing: [
 {
 method: 'GET',
 path: '/api/v1/shares',
 description: 'List share links with pagination and filters.',
 permission: 'read',
 query: {
 targetType: 'Filter: "asset" | "folder" | "root"',
 targetId: 'Filter by specific target ID',
 page: 'Page number (default: 1)',
 limit: 'Items per page (default: 20, max: 50)',
 active: '"true" | "false" (default: "true")',
 },
 response: `{
 "shares": [{
 "_id": "...", "token": "abc123",
 "targetType": "folder", "targetIds": ["f1"],
 "targetName": "Wedding Album", "permission": "view",
 "hasPassword": false, "expiresAt": null,
 "isActive": true, "accessCount": 5,
 "allowedEmails": [], "allowedMemberIds": [],
 "allowedGroupIds": []
 }],
 "page": 1, "total": 3, "totalPages": 1
}`,
 },
 {
 method: 'POST',
 path: '/api/v1/shares',
 description: 'Create a share link for assets, folders, or the entire org.',
 permission: 'write',
 body: {
 targetType: '(required) "asset" | "folder" | "root"',
 targetId: '(required for asset/folder) Target ID',
 targetIds: '(optional) Array of IDs for multi-asset shares',
 permission: '(optional) "view" | "edit" | "admin" (default: "view")',
 expiresIn:
 '(optional) "1h" | "1d" | "7d" | "30d" | "never" (default: "never")',
 password: '(optional) Password protect the link',
 allowedEmails: '(optional) Restrict to specific emails',
 allowedMemberIds: '(optional) Restrict to org member IDs',
 allowedGroupIds: '(optional) Restrict to member group IDs',
 includeNested: '(optional) Include subfolders (default: true)',
 maxDownloads: '(optional) Maximum number of downloads',
 },
 response: `{
 "share": {
 "_id": "...", "token": "abc123",
 "shareUrl": "https://your-domain/s/abc123",
 "targetType": "folder", "permission": "view",
 "expiresAt": null, "hasPassword": false
 }
}`,
 },
 {
 method: 'GET',
 path: '/api/v1/shares/:token',
 description:
 'Get full details of a share link including target name and access stats.',
 permission: 'read',
 response: `{
 "share": {
 "token": "abc123", "targetType": "folder",
 "targetName": "Wedding Album", "permission": "view",
 "hasPassword": false, "isActive": true,
 "accessCount": 5, "maxDownloads": null,
 "allowedEmails": [], "expiresAt": null
 }
}`,
 },
 {
 method: 'PATCH',
 path: '/api/v1/shares/:token',
 description: 'Update share link settings (permission, expiry, password, audience).',
 permission: 'write',
 body: {
 permission: '(optional) "view" | "edit" | "admin"',
 expiresAt: '(optional) ISO date or null to remove',
 password: '(optional) New password or null to remove',
 isActive: '(optional) Enable/disable link',
 maxDownloads: '(optional) Download limit or null',
 allowedEmails: '(optional) Restrict to emails',
 allowedMemberIds: '(optional) Restrict to member IDs',
 allowedGroupIds: '(optional) Restrict to group IDs',
 },
 response: `{
 "share": {
 "token": "abc123", "permission": "edit",
 "hasPassword": true, "isActive": true
 }
}`,
 },
 {
 method: 'DELETE',
 path: '/api/v1/shares/:token',
 description: 'Revoke a share link (sets isActive=false).',
 permission: 'write',
 response: `{ "success": true, "share": { "token": "abc123", "isActive": false } }`,
 },
 ],
 Faces: [
 {
 method: 'GET',
 path: '/api/v1/faces',
 description: 'List unique detected faces across all assets, with names and thumbnails.',
 permission: 'read',
 query: {
 page: 'Page number (default: 1)',
 limit: 'Items per page (default: 20, max: 50)',
 },
 response: `{
 "faces": [{
 "faceHash": "abc123...",
 "displayName": "Jane Doe",
 "assetCount": 12,
 "thumbnailUrl": "https://...",
 "confidence": 0.95,
 "boundingBox": { "x": 10, "y": 10, "w": 50, "h": 50 }
 }],
 "page": 1, "total": 45, "totalPages": 3
}`,
 },
 {
 method: 'GET',
 path: '/api/v1/faces/:faceHash',
 description: 'List all assets containing a specific face with signed URLs.',
 permission: 'read',
 query: {
 page: 'Page number (default: 1)',
 limit: 'Items per page (default: 30, max: 100)',
 },
 response: `{
 "faceHash": "abc123...", "displayName": "Jane Doe",
 "assets": [{ "_id": "...", "name": "photo.jpg", "url": "...", "face": { "confidence": 0.95 } }],
 "page": 1, "total": 12, "totalPages": 1
}`,
 },
 {
 method: 'PATCH',
 path: '/api/v1/faces/:faceHash',
 description: 'Name or un-name a detected face.',
 permission: 'write',
 body: {
 displayName: '(required) Name string, or "" / null to remove',
 },
 response: `{ "faceHash": "abc123...", "displayName": "Jane Doe" }`,
 },
 {
 method: 'POST',
 path: '/api/v1/faces/search',
 description: 'Search for a person across assets by uploading a selfie (uses Gemini).',
 permission: 'read',
 body: {
 selfieBase64: '(required*) Base64-encoded selfie',
 selfieUrl: '(required*) OR a URL to the selfie',
 maxResults: '(optional) Max results (default: 50, max: 100)',
 folderId: '(optional) Restrict search to folder',
 },
 response: `{
 "matches": [{
 "assetId": "...", "name": "photo.jpg",
 "url": "...", "confidence": 0.92,
 "faceHash": "abc123..."
 }],
 "totalCandidates": 250,
 "searchJobId": "..."
}`,
 },
 ],
 AI: [
 {
 method: 'POST',
 path: '/api/v1/ai/auto-tag',
 description: 'Auto-tag an asset using AI vision.',
 permission: 'ai',
 body: { assetId: '(required) Asset ID to tag' },
 response: `{ "tags": ["sunset", "beach", "ocean"] }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/bg-remove',
 description: 'Remove background from an image.',
 permission: 'ai',
 body: { assetId: '(required) Asset ID' },
 response: `{ "jobId": "...", "variant": { "key": "bg-removed" } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/upscale',
 description: 'Upscale an image 2× or 4×.',
 permission: 'ai',
 body: { assetId: '(required)', scaleFactor: '(required) 2 or 4' },
 response: `{ "jobId": "...", "variant": { "key": "upscaled-2x" } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/expand',
 description: 'AI outpainting — expand image dimensions.',
 permission: 'ai',
 body: {
 assetId: '(required)',
 targetWidth: '(required)',
 targetHeight: '(required)',
 },
 response: `{ "jobId": "...", "variant": { "key": "expanded-2000x1200" } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/generate',
 description: 'Generate an image from a text prompt.',
 permission: 'ai',
 body: {
 prompt: '(required)',
 style: '(optional)',
 width: '(optional)',
 height: '(optional)',
 },
 response: `{ "jobId": "...", "asset": { "_id": "..." } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/beautify',
 description: 'Enhance photo quality with AI beautification.',
 permission: 'ai',
 body: {
 assetId: '(required) Asset ID',
 strength: '(optional) "light" | "medium" | "strong" (default: "medium")',
 },
 response: `{ "jobId": "...", "status": "completed", "result": { "variantKey": "...", "strength": "medium" } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/remove-object',
 description: 'Remove a specified object from an image.',
 permission: 'ai',
 body: {
 assetId: '(required) Asset ID',
 description: '(required) What to remove (e.g. "the red car")',
 maskBase64: '(optional) Highlight area as base64 image',
 },
 response: `{ "jobId": "...", "status": "completed", "result": { "variantKey": "...", "description": "..." } }`,
 },
 {
 method: 'POST',
 path: '/api/v1/ai/retouch',
 description: 'Apply portrait retouching with configurable features.',
 permission: 'ai',
 body: {
 assetId: '(required) Asset ID',
 features: '(optional) Array: skin_smoothing, blemish_removal, teeth_whitening, red_eye_removal, skin_tone_evening',
 intensity: '(optional) "subtle" | "moderate" | "full" (default: "moderate")',
 },
 response: `{ "jobId": "...", "status": "completed", "result": { "variantKey": "...", "features": [...], "intensity": "..." } }`,
 },
 {
 method: 'GET',
 path: '/api/v1/ai/jobs/:id',
 description: 'Check AI job status.',
 permission: 'ai',
 response: `{ "job": { "type": "bg_remove", "status": "completed", "result": {} } }`,
 },
 ],
};

const METHOD_COLORS: Record<string, string> = {
 GET: 'bg-emerald-100 text-emerald-700',
 POST: 'bg-blue-100 text-blue-700',
 PATCH: 'bg-amber-100 text-amber-700',
 PUT: 'bg-violet-100 text-violet-700',
 DELETE: 'bg-red-100 text-red-700',
};

const SECTION_ICONS: Record<string, typeof BookOpen> = {
 Assets: FileImage,
 Transforms: ArrowRightLeft,
 Folders: FolderOpen,
 Upload: Upload,
 Teams: Users,
 Sharing: Share2,
 Faces: ScanFace,
 AI: Sparkles,
};

/* ─── Transform Reference Data ─────────────────────────────── */

const TRANSFORM_REFERENCE = [
 {
 key: 'w',
 name: 'Width',
 type: 'number',
 range: '1–10000',
 default: '—',
 example: 'w-300',
 desc: 'Resize width in pixels',
 },
 {
 key: 'h',
 name: 'Height',
 type: 'number',
 range: '1–10000',
 default: '—',
 example: 'h-200',
 desc: 'Resize height in pixels',
 },
 {
 key: 'c',
 name: 'Crop',
 type: 'enum',
 range: 'fill, fit, cover, contain, thumb',
 default: 'fill',
 example: 'c-cover',
 desc: 'Crop/fit mode when both w & h set',
 },
 {
 key: 'g',
 name: 'Gravity',
 type: 'enum',
 range:
 'center, face, auto, north, south, east, west, northeast, northwest, southeast, southwest',
 default: 'center',
 example: 'g-face',
 desc: 'Focus point for cropping',
 },
 {
 key: 'dpr',
 name: 'DPR',
 type: 'number',
 range: '1–3',
 default: '1',
 example: 'dpr-2',
 desc: 'Device pixel ratio multiplier',
 },
 {
 key: 'f / fmt',
 name: 'Format',
 type: 'enum',
 range: 'jpeg, png, webp, avif, auto, original',
 default: 'auto',
 example: 'f-webp',
 desc: 'Output image format',
 },
 {
 key: 'q',
 name: 'Quality',
 type: 'number',
 range: '1–100',
 default: '80',
 example: 'q-80',
 desc: 'Compression quality (lossy)',
 },
 {
 key: 'bl',
 name: 'Blur',
 type: 'number',
 range: '1–100',
 default: '—',
 example: 'bl-10',
 desc: 'Gaussian blur intensity',
 },
 {
 key: 'sh',
 name: 'Sharpen',
 type: 'number',
 range: '1–100',
 default: '—',
 example: 'sh-20',
 desc: 'Sharpen intensity',
 },
 {
 key: 'rt',
 name: 'Rotation',
 type: 'number',
 range: '0–360',
 default: '0',
 example: 'rt-90',
 desc: 'Rotate by degrees',
 },
 {
 key: 'fl',
 name: 'Flip',
 type: 'enum',
 range: 'h, v, hv',
 default: '—',
 example: 'fl-h',
 desc: 'Mirror/flip the image',
 },
 {
 key: 'e',
 name: 'Effect',
 type: 'enum',
 range: 'grayscale',
 default: '—',
 example: 'e-grayscale',
 desc: 'Visual effects',
 },
 {
 key: 'o',
 name: 'Opacity',
 type: 'number',
 range: '0–100',
 default: '100',
 example: 'o-50',
 desc: 'Transparency level',
 },
 {
 key: 'b',
 name: 'Border',
 type: 'composite',
 range: '{width}_{hexColor}',
 default: '—',
 example: 'b-5_FF0000',
 desc: 'Add border: width + hex color',
 },
 {
 key: 'r',
 name: 'Radius',
 type: 'number/max',
 range: '0–5000 or "max"',
 default: '—',
 example: 'r-20',
 desc: 'Rounded corners (r-max for circle)',
 },
 {
 key: 'bg',
 name: 'Background',
 type: 'hex',
 range: '3–8 char hex',
 default: '—',
 example: 'bg-FFFFFF',
 desc: 'Background color (no # prefix)',
 },
 {
 key: 'n',
 name: 'Named',
 type: 'string',
 range: 'a-z, 0-9, -, _ (max 64)',
 default: '—',
 example: 'n-thumbnail',
 desc: 'Apply a saved transform preset',
 },
];

const PRESET_EXAMPLES = [
 {
 name: 'Thumbnail',
 transform: 'w-200,h-200,c-thumb,g-auto,q-80,f-webp',
 use: 'Grids & lists',
 },
 {
 name: 'Profile Avatar',
 transform: 'w-150,h-150,c-fill,g-face,r-max,q-85,f-webp',
 use: 'User avatars',
 },
 {
 name: 'OG / Social Card',
 transform: 'w-1200,h-630,c-fill,g-auto,q-85,f-jpeg',
 use: 'Open Graph meta',
 },
 {
 name: 'Hero Banner',
 transform: 'w-1920,h-600,c-cover,g-center,q-85,f-webp',
 use: 'Website headers',
 },
 {
 name: 'Product Card',
 transform: 'w-400,h-400,c-contain,bg-FFFFFF,q-90,f-webp',
 use: 'E-commerce',
 },
 {
 name: 'Instagram Square',
 transform: 'w-1080,h-1080,c-fill,g-auto,q-90,f-jpeg',
 use: 'Social posts',
 },
 {
 name: 'Instagram Story',
 transform: 'w-1080,h-1920,c-fill,g-center,q-85,f-jpeg',
 use: 'Stories',
 },
 {
 name: 'Blurred BG',
 transform: 'w-800,h-600,c-fill,bl-40,q-60,f-webp',
 use: 'Overlay backgrounds',
 },
 {
 name: 'Grayscale',
 transform: 'w-600,h-800,c-fill,g-face,e-grayscale,q-85,f-jpeg',
 use: 'B&W portraits',
 },
 { name: 'Email-Safe', transform: 'w-600,q-75,f-jpeg', use: 'Newsletters' },
 {
 name: 'Favicon',
 transform: 'w-32,h-32,c-fill,g-center,f-png',
 use: 'Browser icons',
 },
 {
 name: 'Retina Thumb',
 transform: 'w-200,h-200,c-thumb,g-auto,dpr-2,q-75,f-webp',
 use: 'HiDPI displays',
 },
];

export default function ApiReferencePage() {
 const [activeSection, setActiveSection] = useState('Assets');
 const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
 const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

 const copySnippet = async (text: string, key: string) => {
 await navigator.clipboard.writeText(text);
 setCopiedSnippet(key);
 setTimeout(() => setCopiedSnippet(null), 2000);
 };

 const generateCurl = (ep: Endpoint) => {
 const parts = [`curl -X ${ep.method}`];
 parts.push(` -H "Authorization: Bearer YOUR_API_KEY"`);
 if (ep.body) {
 parts.push(` -H "Content-Type: application/json"`);
 const bodyObj: Record<string, string> = {};
 for (const k of Object.keys(ep.body)) {
 bodyObj[k] = `<${k}>`;
 }
 parts.push(` -d '${JSON.stringify(bodyObj, null, 2)}'`);
 }
 let url = `https://your-domain${ep.path}`;
 if (ep.query) {
 url +=
 '?' +
 Object.keys(ep.query)
 .map((k) => `${k}=...`)
 .join('&');
 }
 parts.push(` "${url}"`);
 return parts.join(' \\\n');
 };

 const generateJs = (ep: Endpoint) => {
 const opts: string[] = [
 ` method: '${ep.method}',`,
 ` headers: { 'Authorization': 'Bearer YOUR_API_KEY'${ep.body ? ", 'Content-Type': 'application/json'" : ''} },`,
 ];
 if (ep.body) {
 opts.push(
 ` body: JSON.stringify({ ${Object.keys(ep.body)
 .map((k) => `${k}: '...'`)
 .join(', ')} }),`,
 );
 }
 let url = ep.path;
 if (ep.query)
 url +=
 '?' +
 Object.keys(ep.query)
 .map((k) => `${k}=...`)
 .join('&');
 return `const res = await fetch('${url}', {\n${opts.join('\n')}\n});\nconst data = await res.json();`;
 };

 return (
 <div className="flex h-screen bg-dash-surface">
 {/* Sidebar */}
 <aside className="w-56 shrink-0 border-r border-dash-border p-4">
 <div className="mb-6 flex items-center gap-2">
 <BookOpen className="h-5 w-5 text-dash-text" />
 <h1 className="text-lg font-bold text-dash-text">API Reference</h1>
 </div>
 <p className="mb-4 text-xs text-dash-text2">REST API v1</p>
 <nav className="space-y-1">
 {Object.keys(ENDPOINTS).map((section) => {
 const Icon = SECTION_ICONS[section] ?? BookOpen;
 return (
 <button
 key={section}
 onClick={() => setActiveSection(section)}
 className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
 activeSection === section
 ? 'bg-dash-muted font-semibold text-dash-text'
 : 'text-dash-text2 hover:bg-dash-muted'
 }`}
 >
 <Icon className="h-4 w-4" />
 {section}
 <span className="ml-auto text-xs text-dash-text-muted">
 {ENDPOINTS[section].length}
 </span>
 </button>
 );
 })}
 </nav>
 <div className="mt-8 rounded-lg border border-dash-border bg-dash-muted p-3">
 <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-dash-text2">
 <Key className="h-3 w-3" />
 Authentication
 </h3>
 <p className="text-[11px] text-dash-text2">
 All requests require an API key:
 </p>
 <code className="mt-1 block text-[10px] text-dash-text2">
 Authorization: Bearer img_...
 </code>
 </div>
 </aside>

 {/* Main */}
 <main className="flex-1 overflow-y-auto p-8">
 <div className="mx-auto max-w-3xl">
 <h2 className="mb-6 text-2xl font-bold text-dash-text">
 {activeSection}
 </h2>
 <div className="space-y-4">
 {ENDPOINTS[activeSection]?.map((ep, i) => {
 const key = `${ep.method}-${ep.path}-${i}`;
 const isExpanded = expandedEndpoint === key;
 return (
 <div
 key={key}
 className="rounded-lg border border-dash-border transition hover:shadow-sm"
 >
 <button
 onClick={() => setExpandedEndpoint(isExpanded ? null : key)}
 className="flex w-full items-center gap-3 p-4 text-left"
 >
 <span
 className={`rounded px-2 py-0.5 text-xs font-bold ${METHOD_COLORS[ep.method]}`}
 >
 {ep.method}
 </span>
 <code className="flex-1 text-sm font-medium text-dash-text">
 {ep.path}
 </code>
 <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] text-dash-text2">
 {ep.permission}
 </span>
 <ChevronRight
 className={`h-4 w-4 text-dash-text-muted transition ${isExpanded ? 'rotate-90' : ''}`}
 />
 </button>
 {isExpanded && (
 <div className="border-t border-dash-border p-4">
 <p className="mb-4 text-sm text-dash-text2">
 {ep.description}
 </p>
 {ep.query && (
 <div className="mb-4">
 <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Query Parameters
 </h4>
 <div className="rounded-md border border-dash-border bg-dash-muted p-3">
 {Object.entries(ep.query).map(([k, v]) => (
 <div key={k} className="flex gap-2 py-1 text-xs">
 <code className="font-semibold text-dash-text2">
 {k}
 </code>
 <span className="text-dash-text2">{v}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 {ep.body && (
 <div className="mb-4">
 <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Request Body
 </h4>
 <div className="rounded-md border border-dash-border bg-dash-muted p-3">
 {Object.entries(ep.body).map(([k, v]) => (
 <div key={k} className="flex gap-2 py-1 text-xs">
 <code className="font-semibold text-dash-text2">
 {k}
 </code>
 <span className="text-dash-text2">{v}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 <div className="mb-4">
 <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Response
 </h4>
 <pre className="overflow-x-auto rounded-md border border-dash-border bg-dash-muted p-3 text-xs text-dash-text2">
 {ep.response}
 </pre>
 </div>
 <div>
 <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Code Samples
 </h4>
 <div className="space-y-2">
 <div className="relative rounded-md bg-dash-inverted p-3">
 <div className="mb-1 text-[10px] text-dash-text-muted">
 cURL
 </div>
 <pre className="overflow-x-auto text-xs text-dash-inverted-text">
 {generateCurl(ep)}
 </pre>
 <button
 onClick={() =>
 copySnippet(generateCurl(ep), `curl-${key}`)
 }
 className="absolute right-2 top-2 rounded bg-dash-inverted-hover p-1 text-dash-text-muted hover:bg-dash-inverted"
 >
 {copiedSnippet === `curl-${key}` ? (
 <Check className="h-3 w-3" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 </button>
 </div>
 <div className="relative rounded-md bg-dash-inverted p-3">
 <div className="mb-1 text-[10px] text-dash-text-muted">
 JavaScript
 </div>
 <pre className="overflow-x-auto text-xs text-dash-inverted-text">
 {generateJs(ep)}
 </pre>
 <button
 onClick={() =>
 copySnippet(generateJs(ep), `js-${key}`)
 }
 className="absolute right-2 top-2 rounded bg-dash-inverted-hover p-1 text-dash-text-muted hover:bg-dash-inverted"
 >
 {copiedSnippet === `js-${key}` ? (
 <Check className="h-3 w-3" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* ─── Transform Reference (shown only for Transforms section) ─── */}
 {activeSection === 'Transforms' && (
 <>
 {/* URL Syntax Guide */}
 <div className="mt-8 rounded-lg border border-dash-border bg-dash-muted p-6">
 <h3 className="mb-3 text-lg font-semibold text-dash-text">
 URL Transform Syntax
 </h3>
 <p className="mb-3 text-sm text-dash-text2">
 Transform strings use comma-separated{' '}
 <code className="text-xs bg-dash-badge px-1 rounded">
 key-value
 </code>{' '}
 pairs. Chain multiple independent steps with colons.
 </p>
 <div className="space-y-2 rounded-md bg-dash-inverted p-4">
 <div className="text-[10px] text-dash-text-muted">Single step</div>
 <code className="text-xs text-emerald-400">
 w-300,h-300,q-80,f-webp
 </code>
 <div className="mt-3 text-[10px] text-dash-text-muted">
 Chained steps (resize → rotate → blur)
 </div>
 <code className="text-xs text-emerald-400">
 w-400,h-300,c-fill:rt-90:bl-10
 </code>
 </div>
 </div>

 {/* All Transform Keys */}
 <div className="mt-8 rounded-lg border border-dash-border bg-dash-muted p-6">
 <h3 className="mb-4 text-lg font-semibold text-dash-text">
 Transform Parameters Reference
 </h3>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-dash-border text-xs uppercase text-dash-text-muted">
 <th className="pb-2 pr-3">Key</th>
 <th className="pb-2 pr-3">Name</th>
 <th className="pb-2 pr-3">Type</th>
 <th className="pb-2 pr-3">Range / Values</th>
 <th className="pb-2 pr-3">Default</th>
 <th className="pb-2 pr-3">Example</th>
 <th className="pb-2">Description</th>
 </tr>
 </thead>
 <tbody className="text-dash-text2">
 {TRANSFORM_REFERENCE.map((t) => (
 <tr key={t.key} className="border-b border-dash-border">
 <td className="py-2 pr-3">
 <code className="text-xs font-bold text-blue-600">
 {t.key}
 </code>
 </td>
 <td className="py-2 pr-3 font-medium text-xs">
 {t.name}
 </td>
 <td className="py-2 pr-3 text-xs text-dash-text2">
 {t.type}
 </td>
 <td className="py-2 pr-3 text-xs text-dash-text2 max-w-[200px]">
 {t.range}
 </td>
 <td className="py-2 pr-3 text-xs text-dash-text2">
 {t.default}
 </td>
 <td className="py-2 pr-3">
 <code className="text-[10px] bg-dash-badge px-1 rounded">
 {t.example}
 </code>
 </td>
 <td className="py-2 text-xs text-dash-text2">
 {t.desc}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Example Presets */}
 <div className="mt-8 rounded-lg border border-dash-border bg-dash-muted p-6">
 <h3 className="mb-4 text-lg font-semibold text-dash-text">
 Example Presets
 </h3>
 <p className="mb-4 text-sm text-dash-text2">
 Ready-to-use transform strings for common use cases. Copy and
 use directly in your API calls.
 </p>
 <div className="grid gap-3 sm:grid-cols-2">
 {PRESET_EXAMPLES.map((p) => (
 <div
 key={p.name}
 className="rounded-md border border-dash-border bg-dash-surface p-3"
 >
 <div className="mb-1 flex items-center justify-between">
 <span className="text-xs font-semibold text-dash-text">
 {p.name}
 </span>
 <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] text-dash-text2">
 {p.use}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <code className="flex-1 truncate text-[10px] text-dash-text2">
 {p.transform}
 </code>
 <button
 onClick={() =>
 copySnippet(p.transform, `preset-${p.name}`)
 }
 className="shrink-0 rounded bg-dash-muted p-1 text-dash-text-muted hover:bg-dash-badge hover:text-dash-text2"
 >
 {copiedSnippet === `preset-${p.name}` ? (
 <Check className="h-3 w-3" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </>
 )}

 {/* Rate limiting & Error codes */}
 <div className="mt-12 rounded-lg border border-dash-border bg-dash-muted p-6">
 <h3 className="mb-3 text-lg font-semibold text-dash-text">
 Rate Limiting
 </h3>
 <p className="mb-4 text-sm text-dash-text2">
 API requests are rate-limited per API key. Returns{' '}
 <code className="text-xs">429</code> with{' '}
 <code className="text-xs">Retry-After</code> header.
 </p>
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-dash-border text-xs uppercase text-dash-text-muted">
 <th className="pb-2">Plan</th>
 <th className="pb-2">Req/min</th>
 <th className="pb-2">Uploads/min</th>
 <th className="pb-2">AI/min</th>
 </tr>
 </thead>
 <tbody className="text-dash-text2">
 <tr className="border-b border-dash-border">
 <td className="py-2 font-medium">Free</td>
 <td>60</td>
 <td>10</td>
 <td>5</td>
 </tr>
 <tr className="border-b border-dash-border">
 <td className="py-2 font-medium">Pro</td>
 <td>300</td>
 <td>50</td>
 <td>20</td>
 </tr>
 <tr>
 <td className="py-2 font-medium">Enterprise</td>
 <td>1,000</td>
 <td>200</td>
 <td>100</td>
 </tr>
 </tbody>
 </table>
 </div>

 <div className="mt-8 rounded-lg border border-dash-border bg-dash-muted p-6">
 <h3 className="mb-3 text-lg font-semibold text-dash-text">
 Error Codes
 </h3>
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-dash-border text-xs uppercase text-dash-text-muted">
 <th className="pb-2">Code</th>
 <th className="pb-2">Status</th>
 <th className="pb-2">Description</th>
 </tr>
 </thead>
 <tbody className="text-dash-text2">
 {[
 ['AUTH_REQUIRED', '401', 'Missing or invalid API key'],
 ['INVALID_KEY', '401', 'Expired or revoked key'],
 ['FORBIDDEN', '403', 'Lacking permission or origin blocked'],
 ['NOT_FOUND', '404', 'Resource not found'],
 ['VALIDATION_ERROR', '400', 'Invalid request'],
 ['RATE_LIMITED', '429', 'Too many requests'],
 ].map(([code, status, desc]) => (
 <tr key={code} className="border-b border-dash-border">
 <td className="py-2">
 <code className="text-xs font-medium">{code}</code>
 </td>
 <td className="py-2">{status}</td>
 <td className="py-2 text-dash-text2">{desc}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </main>
 </div>
 );
}
