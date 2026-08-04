// SPDX-License-Identifier: Apache-2.0
/**
 * Connection Resilience Engine — Tests
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  acknowledgeBufferedEvents,
  buildConflictToast,
  buildReconnectSummary,
  calculateReconnectDelay,
  createConnectionResilienceState,
  dropExpiredBufferedEvents,
  enqueueBufferedEvent,
  flushBufferedEvents,
  markConnectionConnected,
  markConnectionDisconnected,
  pushToast,
  removeFlushedEvents,
  scheduleReconnect,
  shouldQueueWhileOffline,
} from '@/lib/connection-resilience-engine';

const NOW = new Date('2026-03-06T12:00:00Z');

describe('connection-resilience-engine state', () => {
  it('creates initial state', () => {
    const state = createConnectionResilienceState(NOW);
    expect(state.status).toBe('connecting');
    expect(state.bufferedEvents).toHaveLength(0);
    expect(state.retryCount).toBe(0);
  });

  it('calculates reconnect delay', () => {
    expect(calculateReconnectDelay(0, DEFAULT_RETRY_POLICY)).toBeGreaterThan(0);
    expect(calculateReconnectDelay(3, DEFAULT_RETRY_POLICY)).toBeGreaterThan(
      calculateReconnectDelay(0, DEFAULT_RETRY_POLICY),
    );
  });

  it('queues event', () => {
    const state = enqueueBufferedEvent(createConnectionResilienceState(NOW), {
      id: 'evt_1',
      kind: 'operation',
      payload: { opId: '1' },
      queuedAt: NOW,
      expiresAt: null,
    });
    expect(state.bufferedEvents).toHaveLength(1);
    expect(state.bufferedEvents[0].attempts).toBe(0);
  });

  it('marks disconnected and reconnecting', () => {
    const disconnected = markConnectionDisconnected(createConnectionResilienceState(NOW), NOW);
    expect(disconnected.status).toBe('disconnected');
    const reconnecting = scheduleReconnect(disconnected, DEFAULT_RETRY_POLICY, NOW);
    expect(reconnecting.status).toBe('reconnecting');
    expect(reconnecting.retryCount).toBe(1);
    expect(reconnecting.nextRetryAt).not.toBeNull();
  });

  it('marks connected and resets retries', () => {
    const reconnecting = scheduleReconnect(createConnectionResilienceState(NOW), DEFAULT_RETRY_POLICY, NOW);
    const connected = markConnectionConnected(reconnecting, NOW);
    expect(connected.status).toBe('connected');
    expect(connected.retryCount).toBe(0);
    expect(connected.nextRetryAt).toBeNull();
  });
});

describe('connection-resilience-engine buffering', () => {
  function bufferedState() {
    let state = createConnectionResilienceState(NOW);
    state = enqueueBufferedEvent(state, {
      id: 'evt_1',
      kind: 'presence',
      payload: { cursor: [1, 2] },
      queuedAt: NOW,
      expiresAt: null,
    });
    state = enqueueBufferedEvent(state, {
      id: 'evt_2',
      kind: 'operation',
      payload: { opId: '2' },
      queuedAt: NOW,
      expiresAt: new Date('2026-03-07T00:00:00Z'),
    });
    return state;
  }

  it('drops expired events', () => {
    const state = enqueueBufferedEvent(createConnectionResilienceState(NOW), {
      id: 'expired',
      kind: 'system',
      payload: {},
      queuedAt: NOW,
      expiresAt: new Date('2026-03-05T00:00:00Z'),
    });
    expect(dropExpiredBufferedEvents(state, NOW).bufferedEvents).toHaveLength(0);
  });

  it('acknowledges buffered events', () => {
    const next = acknowledgeBufferedEvents(bufferedState(), ['evt_1']);
    expect(next.ackedEventIds).toContain('evt_1');
    expect(next.bufferedEvents).toHaveLength(1);
  });

  it('flushes buffered events and increments attempts', () => {
    const { nextState, flushed } = flushBufferedEvents(bufferedState(), 1);
    expect(flushed).toHaveLength(1);
    expect(flushed[0].attempts).toBe(1);
    expect(nextState.bufferedEvents[0].attempts).toBe(1);
  });

  it('removes flushed events', () => {
    const state = removeFlushedEvents(bufferedState(), ['evt_1']);
    expect(state.bufferedEvents).toHaveLength(1);
    expect(state.bufferedEvents[0].id).toBe('evt_2');
  });
});

describe('connection-resilience-engine toasts and summaries', () => {
  it('builds a conflict toast', () => {
    const toast = buildConflictToast('Selection conflict detected', 'warning', NOW);
    expect(toast.level).toBe('warning');
    expect(toast.message).toContain('conflict');
  });

  it('pushes toasts with cap', () => {
    let state = createConnectionResilienceState(NOW);
    for (let i = 0; i < 6; i++) {
      state = pushToast(state, buildConflictToast(`toast ${i}`, 'info', NOW), 5);
    }
    expect(state.toasts).toHaveLength(5);
  });

  it('knows when to queue while offline', () => {
    expect(shouldQueueWhileOffline('disconnected')).toBe(true);
    expect(shouldQueueWhileOffline('reconnecting')).toBe(true);
    expect(shouldQueueWhileOffline('connected')).toBe(false);
  });

  it('builds reconnect summary', () => {
    const state = pushToast(
      enqueueBufferedEvent(scheduleReconnect(createConnectionResilienceState(NOW), DEFAULT_RETRY_POLICY, NOW), {
        id: 'evt_1',
        kind: 'operation',
        payload: {},
        queuedAt: NOW,
        expiresAt: null,
      }),
      buildConflictToast('retrying', 'info', NOW),
    );
    const summary = buildReconnectSummary(state, NOW);
    expect(summary.status).toBe('reconnecting');
    expect(summary.bufferedCount).toBe(1);
    expect(summary.retryCount).toBe(1);
    expect(summary.hasPendingToasts).toBe(true);
  });
});
