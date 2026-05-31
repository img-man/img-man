import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeTagLabel,
  createNullVisionProvider,
  createAiRegistry,
  createDefaultAiRegistry,
} from '../../src/lib/ai/provider.js';

test('normalizeTagLabel slugs text', () => {
  assert.equal(normalizeTagLabel('Happy  Dog!'), 'happy-dog');
  assert.equal(normalizeTagLabel('  A_B '), 'a-b');
});

test('null vision derives tags from filename and alt', async () => {
  const p = createNullVisionProvider();
  assert.equal(p.id, 'null-vision');
  const tags = await p.tagImage({ filename: 'sunset-beach.png', altText: 'calm ocean' });
  const labels = tags.map((t) => t.label);
  assert.ok(labels.includes('sunset'));
  assert.ok(labels.includes('beach'));
  assert.ok(labels.includes('calm'));
  assert.ok(labels.includes('ocean'));
  for (const t of tags) assert.equal(t.confidence, 0.5);
});

test('null vision dedupes, drops short tokens, caps at 8', async () => {
  const p = createNullVisionProvider();
  const tags = await p.tagImage({
    filename: 'a-a-one-two-three-four-five-six-seven-eight-nine.jpg',
  });
  const labels = tags.map((t) => t.label);
  assert.ok(!labels.includes('a')); // too short
  assert.ok(labels.length <= 8);
  assert.equal(new Set(labels).size, labels.length);
});

test('null vision handles empty input', async () => {
  const p = createNullVisionProvider();
  assert.deepEqual(await p.tagImage(), []);
});

test('ai registry registers/resolves by capability', () => {
  const r = createAiRegistry();
  const prov = { id: 'x' };
  r.register('vision', prov);
  assert.equal(r.has('vision'), true);
  assert.equal(r.resolve('vision'), prov);
  assert.equal(r.resolve('vision', 'x'), prov);
});

test('ai registry guards and errors', () => {
  const r = createAiRegistry();
  assert.throws(() => r.register('vision', {}), TypeError);
  r.register('vision', { id: 'x' });
  assert.throws(() => r.register('vision', { id: 'x' }));
  assert.throws(() => r.resolve('missing'));
  assert.throws(() => r.resolve('vision', 'nope'));
});

test('default ai registry seeds null vision', () => {
  const r = createDefaultAiRegistry();
  assert.equal(r.resolve('vision').id, 'null-vision');
});
