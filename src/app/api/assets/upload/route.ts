// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, isActorErrorResponse } from '@/lib/actor-auth';
import { BLOCKED_EXTENSIONS } from '@/lib/file-types';
import { canPerform } from '@/lib/permissions';
import { uploadBuffer } from '@/lib/storage';

function getStorageErrorMessage(error: unknown) {
	const fallback = 'Upload failed due to storage configuration error';
	if (!(error instanceof Error)) {
		return fallback;
	}

	const lower = error.message.toLowerCase();
	if (lower.includes('invalid_grant') && lower.includes('account not found')) {
		return 'GCP service-account credentials are invalid (account not found). Reconnect Storage credentials in Settings -> Storage or update your service-account env values.';
	}

	if (lower.includes('unable to decrypt stored gcp credentials')) {
		return 'Stored GCP credentials cannot be decrypted. Re-save the Storage credentials in Settings -> Storage.';
	}

	if (lower.includes('invalid gcp service account json')) {
		return 'Stored GCP service-account JSON is invalid. Re-save a valid key in Settings -> Storage.';
	}

	return error.message || fallback;
}

/**
 * POST /api/assets/upload
 * Body: multipart/form-data with `file`, optional `fileName`, optional
 * `contentType`.
 *
 * This is a same-origin fallback for environments where browser-to-GCS signed
 * PUT uploads are blocked by bucket CORS. The actual Asset document is still
 * created by `/api/assets/confirm` so the rest of the upload pipeline stays
 * unchanged.
 */
export async function POST(req: NextRequest) {
	const actor = await getActorFromRequest(req, 'write');
	if (isActorErrorResponse(actor)) return actor;

	if (!canPerform(actor.role, 'upload')) {
		return NextResponse.json(
			{ error: 'Insufficient permissions' },
			{ status: 403 },
		);
	}

	const formData = await req.formData();
	const file = formData.get('file');
	if (!file || typeof file === 'string') {
		return NextResponse.json(
			{ error: 'file is required' },
			{ status: 400 },
		);
	}

	const requestedName = formData.get('fileName');
	const requestedContentType = formData.get('contentType');
	const fileName =
		typeof requestedName === 'string' && requestedName.trim()
			? requestedName.trim()
			: file.name || 'upload.bin';
	const contentType =
		typeof requestedContentType === 'string' && requestedContentType.trim()
			? requestedContentType.trim()
			: file.type || 'application/octet-stream';

	const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
	if (BLOCKED_EXTENSIONS.has(ext)) {
		return NextResponse.json(
			{ error: `File extension .${ext} is blocked for security reasons` },
			{ status: 400 },
		);
	}

	const storageKey = `${actor.orgId}/${randomUUID()}.${ext}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	try {
		await uploadBuffer(
			storageKey,
			buffer,
			contentType,
			undefined,
			undefined,
			actor.orgId,
		);
	} catch (error) {
		console.error('[assets/upload] storage upload failed', error);
		return NextResponse.json(
			{ error: getStorageErrorMessage(error) },
			{ status: 502 },
		);
	}

	return NextResponse.json({ storageKey }, { status: 201 });
}
