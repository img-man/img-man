import { NextResponse } from 'next/server.js';

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: 'live',
    timestamp: new Date().toISOString(),
  });
}
