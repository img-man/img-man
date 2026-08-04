// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, isActorErrorResponse } from '@/lib/actor-auth';
import { getSignedUploadUrl } from '@/lib/storage';
import { randomUUID } from 'crypto';
import { canPerform } from '@/lib/permissions';
import { BLOCKED_EXTENSIONS } from '@/lib/file-types';

function getStorageErrorMessage(error: unknown) {
	const fallback = 'Could not generate upload URL due to storage configuration error';
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
 * POST /api/assets/upload-url
 * Body: { fileName, contentType, folderId? }
 * Returns a presigned PUT URL and the storage key.
 *
 * Auth: NextAuth session OR Bearer token (`imgt_…` / `img_…`). Bearer is
 * preferred when present so the embedded dashboard works the same as the
 * native dashboard.
 */
export async function POST(req: NextRequest) {
	const actor = await getActorFromRequest(req, 'write');
	if (isActorErrorResponse(actor)) return actor;

	// RBAC: require upload permission (editor+)
	if (!canPerform(actor.role, 'upload')) {
		return NextResponse.json(
			{ error: 'Insufficient permissions' },
			{ status: 403 },
		);
	}

	const { fileName, contentType } = await req.json();
	if (!fileName || !contentType) {
		return NextResponse.json(
			{ error: 'fileName and contentType are required' },
			{ status: 400 },
		);
	}

	const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
	if (BLOCKED_EXTENSIONS.has(ext)) {
		return NextResponse.json(
			{ error: `File extension .${ext} is blocked for security reasons` },
			{ status: 400 },
		);
	}

	const storageKey = `${actor.orgId}/${randomUUID()}.${ext}`;

	let uploadUrl: string;
	try {
		uploadUrl = await getSignedUploadUrl(
			storageKey,
			contentType,
			undefined,
			undefined,
			actor.orgId,
		);
	} catch (error) {
		console.error('[assets/upload-url] signed URL generation failed', error);
		return NextResponse.json(
			{ error: getStorageErrorMessage(error) },
			{ status: 502 },
		);
	}

	return NextResponse.json({ uploadUrl, storageKey });
}
