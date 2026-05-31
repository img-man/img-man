import { createReadyHealthResponse } from '@/lib/health';

export async function GET() {
  return createReadyHealthResponse();
}
