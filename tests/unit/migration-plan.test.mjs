import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMigrationManifest,
  planMigrationBatches,
} from '../../src/lib/migration/plan.js';

test('buildMigrationManifest normalizes, dedupes, sorts', () => {
  const m = buildMigrationManifest({
    from: 'memory',
    to: 'gcs',
    items: [
      { key: 'b.png', size: 10 },
      { key: 'a.png', size: 5 },
      { key: 'b.png', size: 99 }, // duplicate ignored
      { key: 'c.png' }, // missing size -> 0
    ],
  });
  assert.equal(m.from, 'memory');
  assert.equal(m.to, 'gcs');
  assert.deepEqual(m.items.map((i) => i.key), ['a.png', 'b.png', 'c.png']);
  assert.equal(m.totalItems, 3);
  assert.equal(m.totalBytes, 15);
});

test('buildMigrationManifest validates input', () => {
  assert.throws(() => buildMigrationManifest({ from: '', to: 'x', items: [] }));
  assert.throws(() => buildMigrationManifest({ from: 'a', to: 'a', items: [] }), /must differ/);
  assert.throws(() => buildMigrationManifest({ from: 'a', to: 'b', items: 'no' }), TypeError);
  assert.throws(() => buildMigrationManifest({ from: 'a', to: 'b', items: [{ key: '../x' }] }));
});

test('planMigrationBatches splits items', () => {
  const m = buildMigrationManifest({
    from: 'a',
    to: 'b',
    items: Array.from({ length: 5 }, (_, i) => ({ key: `k${i}.png`, size: 1 })),
  });
  const batches = planMigrationBatches(m, 2);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].length, 2);
  assert.equal(batches[2].length, 1);
});

test('planMigrationBatches default and validation', () => {
  const m = buildMigrationManifest({ from: 'a', to: 'b', items: [{ key: 'x.png' }] });
  assert.equal(planMigrationBatches(m).length, 1);
  assert.throws(() => planMigrationBatches(m, 0), RangeError);
});
