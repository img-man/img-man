import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadyHealthResponse } from '../../src/lib/health.js';

test('createReadyHealthResponse reports ready when the database ping succeeds', async () => {
  const response = await createReadyHealthResponse({
    connectToDatabase: async () => undefined,
  });

  assert.equal(response.status, 200);

  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(json.status, 'ready');
  assert.equal(json.database, 'up');
  assert.ok(Date.parse(json.timestamp));
});

test('createReadyHealthResponse reports 503 when the database ping fails', async () => {
  const response = await createReadyHealthResponse({
    connectToDatabase: async () => {
      throw new Error('database unreachable');
    },
  });

  assert.equal(response.status, 503);

  const json = await response.json();
  assert.equal(json.ok, false);
  assert.equal(json.status, 'not-ready');
  assert.equal(json.database, 'down');
  assert.match(json.error, /database unreachable/i);
});
