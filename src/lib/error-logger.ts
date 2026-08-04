// SPDX-License-Identifier: Apache-2.0
import { connectToDatabase } from '@/lib/db';
import { ErrorLog } from '@/models';
import type { Types } from 'mongoose';

interface LogErrorParams {
 errorType: string;
 message: string;
 stack?: string;
 endpoint?: string;
 statusCode?: number;
 userAgent?: string;
 orgId?: Types.ObjectId | string;
 userId?: Types.ObjectId | string;
 metadata?: Record<string, unknown>;
}

/**
 * Log an error to the ErrorLog collection for platform admin monitoring.
 * This is a fire-and-forget utility — it won't throw even if the write fails.
 *
 * Usage in API routes / Server Actions:
 * ```ts
 * import { logError } from '@/lib/error-logger';
 * await logError({
 * errorType: 'UPLOAD_FAILED',
 * message: err.message,
 * stack: err.stack,
 * endpoint: '/api/assets/upload',
 * statusCode: 500,
 * orgId: session.orgId,
 * userId: session.userId,
 * });
 * ```
 */
export async function logError(params: LogErrorParams): Promise<void> {
 try {
 await connectToDatabase();
 await ErrorLog.create({
 errorType: params.errorType,
 message: params.message.slice(0, 2000), // cap length
 stack: params.stack?.slice(0, 5000),
 endpoint: params.endpoint,
 statusCode: params.statusCode,
 userAgent: params.userAgent,
 orgId: params.orgId || undefined,
 userId: params.userId || undefined,
 metadata: params.metadata,
 });
 } catch (e) {
 // Swallow — logging shouldn't crash the app
 console.error('[ErrorLogger] Failed to write error log:', e instanceof Error ? e.message : e);
 }
}
