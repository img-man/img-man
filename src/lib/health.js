import { NextResponse } from 'next/server.js';
import { connectToDatabase } from './db.js';

export async function createReadyHealthResponse(options = {}) {
  const connect = options.connectToDatabase ?? connectToDatabase;

  try {
    await connect();

    return NextResponse.json({
      ok: true,
      status: 'ready',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: 'not-ready',
        database: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
