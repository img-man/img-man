import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        if (!address || typeof address === 'string') {
          reject(new Error('Unable to determine a free port.'));
          return;
        }

        resolve(address.port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

test('built app serves the homepage and health endpoints end to end', { timeout: 120000 }, async (t) => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NEXT_PUBLIC_APP_URL: baseUrl,
      NEXTAUTH_URL: baseUrl,
      MONGODB_URI: 'mongodb://127.0.0.1:27018/imageman-e2e',
      MONGODB_DB: 'imageman-e2e',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let combinedOutput = '';
  child.stdout.on('data', (chunk) => {
    combinedOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    combinedOutput += chunk.toString();
  });

  t.after(() => {
    child.kill();
  });

  await waitForHttp(`${baseUrl}/api/health/live`);

  const homeResponse = await fetch(baseUrl);
  assert.equal(homeResponse.status, 200);
  const homeHtml = await homeResponse.text();
  assert.match(homeHtml, /img-man is the open-source media operating system/i);

  const liveResponse = await fetch(`${baseUrl}/api/health/live`);
  assert.equal(liveResponse.status, 200);
  const liveJson = await liveResponse.json();
  assert.equal(liveJson.ok, true);
  assert.equal(liveJson.status, 'live');

  const readyResponse = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(readyResponse.status, 503);
  const readyJson = await readyResponse.json();
  assert.equal(readyJson.ok, false);
  assert.equal(readyJson.status, 'not-ready');
  assert.equal(readyJson.database, 'down');

  const transformResponse = await fetch(
    `${baseUrl}/api/transforms/url?assetId=asset_123&width=800&height=600&format=webp&quality=85`,
  );
  assert.equal(transformResponse.status, 200);
  const transformJson = await transformResponse.json();
  assert.equal(transformJson.ok, true);
  const transformUrl = new URL(transformJson.url);
  assert.equal(transformUrl.port, String(port));
  assert.match(transformUrl.hostname, /^(127\.0\.0\.1|localhost)$/);
  assert.match(transformUrl.pathname, /^\/t\/asset_123\/[a-f0-9]{8}\.webp$/);
  assert.match(transformJson.cacheKey, /^[a-f0-9]{8}$/);

  assert.doesNotMatch(combinedOutput, /error: listen eaddrinuse/i);
});
