// SPDX-License-Identifier: Apache-2.0
import { createReadyHealthResponse } from '@/lib/health';

export async function GET() {
 return createReadyHealthResponse();
}