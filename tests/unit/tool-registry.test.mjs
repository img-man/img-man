import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertToolName,
  validateToolArgs,
  createToolRegistry,
} from '../../src/lib/agent/tool-registry.js';

test('assertToolName validates', () => {
  assert.equal(assertToolName('build-url'), 'build-url');
  assert.equal(assertToolName('a_b'), 'a_b');
  assert.throws(() => assertToolName('Bad'));
  assert.throws(() => assertToolName('1x'));
  assert.throws(() => assertToolName(''));
  assert.throws(() => assertToolName(42));
});

test('validateToolArgs enforces schema', () => {
  const tool = {
    input: {
      a: { type: 'string', required: true },
      b: { type: 'number' },
    },
  };
  assert.deepEqual(validateToolArgs(tool, { a: 'x', b: 2, extra: 1 }), { a: 'x', b: 2 });
  assert.deepEqual(validateToolArgs(tool, { a: 'x' }), { a: 'x' });
  assert.throws(() => validateToolArgs(tool, {}), /missing required/);
  assert.throws(() => validateToolArgs(tool, { a: 1 }), TypeError);
  assert.deepEqual(validateToolArgs({}, { z: 1 }), {});
});

test('registry register/get/list/invoke', async () => {
  const r = createToolRegistry();
  r.register({
    name: 'echo',
    description: 'echo a value',
    input: { value: { type: 'string', required: true } },
    async handler({ value }) {
      return value.toUpperCase();
    },
  });
  assert.equal((await r.invoke('echo', { value: 'hi' })), 'HI');
  const list = r.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'echo');
  assert.equal(list[0].description, 'echo a value');
});

test('registry guards', () => {
  const r = createToolRegistry();
  assert.throws(() => r.register({ name: 'Bad', handler() {} }));
  assert.throws(() => r.register({ name: 'ok' }), TypeError);
  r.register({ name: 'ok', handler() {} });
  assert.throws(() => r.register({ name: 'ok', handler() {} }));
  assert.throws(() => r.get('missing'));
});

test('register defaults description and input', () => {
  const r = createToolRegistry();
  r.register({ name: 'bare', handler() {} });
  const [t] = r.list();
  assert.equal(t.description, '');
  assert.deepEqual(t.input, {});
});
