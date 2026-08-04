// SPDX-License-Identifier: Apache-2.0
/**
 * Design Sync Engine — Tests
 */

import { describe, expect, it } from 'vitest';
import type { DesignState, RectEl } from '@/components/design/editor-types';
import {
  applySyncOperation,
  applySyncOperations,
  buildSyncSnapshot,
  createSyncOperation,
  dedupeSyncOperations,
  detectSyncConflicts,
  rebasePendingSyncOperations,
  resolveSyncConflicts,
  sortSyncOperations,
  summarizeSyncOperation,
} from '@/lib/design-sync-engine';

const NOW = new Date('2026-03-06T12:00:00Z');

function rect(id: string, x = 0, y = 0): RectEl {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 100,
    height: 50,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: '#fff',
    stroke: '#000',
    strokeWidth: 1,
    borderRadius: 0,
  };
}

function baseState(): DesignState {
  return {
    version: 1,
    width: 800,
    height: 600,
    background: '#ffffff',
    elements: [rect('el_1', 10, 20)],
  };
}

describe('design-sync-engine operation creation', () => {
  it('creates operation ids automatically', () => {
    const op = createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 1,
      baseVersion: 1,
      type: 'add_element',
      payload: { element: rect('el_2') },
    }, NOW);
    expect(op.opId).toContain('op_collab_1_1');
    expect(op.createdAt).toEqual(NOW);
  });
});

describe('design-sync-engine applySyncOperation', () => {
  it('adds element', () => {
    const next = applySyncOperation(baseState(), createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 1,
      baseVersion: 1,
      type: 'add_element',
      payload: { element: rect('el_2') },
    }, NOW));
    expect(next.elements).toHaveLength(2);
  });

  it('updates element', () => {
    const next = applySyncOperation(baseState(), createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 2,
      baseVersion: 1,
      type: 'update_element',
      payload: { elementId: 'el_1', patch: { opacity: 0.5 } },
    }, NOW));
    expect(next.elements[0].opacity).toBe(0.5);
  });

  it('moves element', () => {
    const next = applySyncOperation(baseState(), createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 3,
      baseVersion: 1,
      type: 'move_element',
      payload: { elementId: 'el_1', x: 50, y: 80 },
    }, NOW));
    expect(next.elements[0].x).toBe(50);
    expect(next.elements[0].y).toBe(80);
  });

  it('removes element', () => {
    const next = applySyncOperation(baseState(), createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 4,
      baseVersion: 1,
      type: 'remove_element',
      payload: { elementId: 'el_1' },
    }, NOW));
    expect(next.elements).toHaveLength(0);
  });

  it('reorders element', () => {
    const state: DesignState = {
      ...baseState(),
      elements: [rect('el_1'), rect('el_2'), rect('el_3')],
    };
    const next = applySyncOperation(state, createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 5,
      baseVersion: 1,
      type: 'reorder_element',
      payload: { elementId: 'el_1', toIndex: 2 },
    }, NOW));
    expect(next.elements[2].id).toBe('el_1');
  });

  it('sets background', () => {
    const next = applySyncOperation(baseState(), createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'collab_1',
      lamport: 6,
      baseVersion: 1,
      type: 'set_background',
      payload: { background: '#111111' },
    }, NOW));
    expect(next.background).toBe('#111111');
  });
});

describe('design-sync-engine ordering and conflicts', () => {
  const op1 = createSyncOperation({
    opId: 'a',
    sessionId: 'sess_1',
    designId: 'design_1',
    collaboratorId: 'c1',
    lamport: 2,
    baseVersion: 1,
    type: 'update_element',
    payload: { elementId: 'el_1', patch: { x: 20 } },
  }, NOW);
  const op2 = createSyncOperation({
    opId: 'b',
    sessionId: 'sess_1',
    designId: 'design_1',
    collaboratorId: 'c2',
    lamport: 1,
    baseVersion: 1,
    type: 'move_element',
    payload: { elementId: 'el_1', x: 99, y: 12 },
  }, NOW);

  it('sorts operations by lamport', () => {
    const sorted = sortSyncOperations([op1, op2]);
    expect(sorted[0].opId).toBe('b');
  });

  it('dedupes by opId', () => {
    const deduped = dedupeSyncOperations([op1, op1, op2]);
    expect(deduped).toHaveLength(2);
  });

  it('detects same target conflicts', () => {
    const conflicts = detectSyncConflicts([op1, op2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('same-target');
  });

  it('resolves conflicts with last write wins', () => {
    const resolved = resolveSyncConflicts([op1, op2], 'last_write_wins');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].opId).toBe('a');
  });

  it('applies resolved operations', () => {
    const next = applySyncOperations(baseState(), [op1, op2]);
    expect(next.elements[0].x).toBe(20);
  });
});

describe('design-sync-engine rebase and snapshot', () => {
  it('rebases pending operations after acknowledged ones', () => {
    const ack = createSyncOperation({
      opId: 'ack',
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'c1',
      lamport: 1,
      baseVersion: 1,
      type: 'update_element',
      payload: { elementId: 'el_1', patch: { opacity: 0.8 } },
    }, NOW);
    const pending = createSyncOperation({
      opId: 'pending',
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'c1',
      lamport: 2,
      baseVersion: 1,
      type: 'move_element',
      payload: { elementId: 'el_1', x: 100, y: 120 },
    }, NOW);
    const result = rebasePendingSyncOperations(baseState(), [ack], [pending]);
    expect(result.pending).toHaveLength(1);
    expect(result.rebasedState.elements[0].opacity).toBe(0.8);
    expect(result.rebasedState.elements[0].x).toBe(100);
  });

  it('builds sync snapshot', () => {
    const snapshot = buildSyncSnapshot(baseState(), 3, [], NOW);
    expect(snapshot.version).toBe(3);
    expect(snapshot.pageCount).toBe(1);
    expect(snapshot.elementCount).toBe(1);
  });

  it('summarizes operation', () => {
    const summary = summarizeSyncOperation(createSyncOperation({
      sessionId: 'sess_1',
      designId: 'design_1',
      collaboratorId: 'c1',
      lamport: 1,
      baseVersion: 1,
      type: 'remove_element',
      payload: { elementId: 'el_1' },
    }, NOW));
    expect(summary.label).toBe('Removed element');
  });
});
