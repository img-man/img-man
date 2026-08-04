// SPDX-License-Identifier: Apache-2.0
/**
 * Connection Resilience Engine — Sprint 17.6
 *
 * Pure helpers for buffering collaborative events, reconnect backoff,
 * acknowledgement tracking, and user-facing conflict/reconnect messaging.
 */

import type { ConnectionStatus } from '@/lib/realtime-collaboration-engine';

export type BufferedEventKind = 'presence' | 'operation' | 'system';

export interface BufferedEvent<T = unknown> {
  id: string;
  kind: BufferedEventKind;
  payload: T;
  queuedAt: Date;
  attempts: number;
  expiresAt: Date | null;
}

export interface ConflictToast {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: Date;
}

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio: number;
}

export interface ConnectionResilienceState {
  status: ConnectionStatus;
  bufferedEvents: BufferedEvent[];
  ackedEventIds: string[];
  retryCount: number;
  nextRetryAt: Date | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  toasts: ConflictToast[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export function createConnectionResilienceState(
  now: Date = new Date(),
): ConnectionResilienceState {
  return {
    status: 'connecting',
    bufferedEvents: [],
    ackedEventIds: [],
    retryCount: 0,
    nextRetryAt: null,
    lastConnectedAt: null,
    lastDisconnectedAt: now,
    toasts: [],
  };
}

export function calculateReconnectDelay(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * policy.multiplier ** Math.max(0, retryCount),
  );
  const jitter = exponential * policy.jitterRatio;
  return Math.round(exponential - jitter / 2);
}

export function enqueueBufferedEvent<T>(
  state: ConnectionResilienceState,
  event: Omit<BufferedEvent<T>, 'attempts'> & { attempts?: number },
): ConnectionResilienceState {
  return {
    ...state,
    bufferedEvents: [
      ...state.bufferedEvents,
      {
        ...event,
        attempts: event.attempts ?? 0,
      },
    ],
  };
}

export function markConnectionDisconnected(
  state: ConnectionResilienceState,
  now: Date = new Date(),
): ConnectionResilienceState {
  return {
    ...state,
    status: state.retryCount > 0 ? 'reconnecting' : 'disconnected',
    lastDisconnectedAt: now,
  };
}

export function scheduleReconnect(
  state: ConnectionResilienceState,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  now: Date = new Date(),
): ConnectionResilienceState {
  const delay = calculateReconnectDelay(state.retryCount, policy);
  return {
    ...state,
    status: 'reconnecting',
    retryCount: state.retryCount + 1,
    nextRetryAt: new Date(now.getTime() + delay),
  };
}

export function markConnectionConnected(
  state: ConnectionResilienceState,
  now: Date = new Date(),
): ConnectionResilienceState {
  return {
    ...state,
    status: 'connected',
    retryCount: 0,
    nextRetryAt: null,
    lastConnectedAt: now,
  };
}

export function dropExpiredBufferedEvents(
  state: ConnectionResilienceState,
  now: Date = new Date(),
): ConnectionResilienceState {
  return {
    ...state,
    bufferedEvents: state.bufferedEvents.filter(
      (event) => event.expiresAt === null || event.expiresAt > now,
    ),
  };
}

export function acknowledgeBufferedEvents(
  state: ConnectionResilienceState,
  eventIds: string[],
): ConnectionResilienceState {
  const acked = new Set([...state.ackedEventIds, ...eventIds]);
  return {
    ...state,
    ackedEventIds: [...acked],
    bufferedEvents: state.bufferedEvents.filter((event) => !acked.has(event.id)),
  };
}

export function flushBufferedEvents(
  state: ConnectionResilienceState,
  limit: number = state.bufferedEvents.length,
): { nextState: ConnectionResilienceState; flushed: BufferedEvent[] } {
  const flushed = state.bufferedEvents.slice(0, limit).map((event) => ({
    ...event,
    attempts: event.attempts + 1,
  }));
  const remaining = state.bufferedEvents.slice(limit);

  return {
    nextState: {
      ...state,
      bufferedEvents: [...flushed, ...remaining],
    },
    flushed,
  };
}

export function removeFlushedEvents(
  state: ConnectionResilienceState,
  eventIds: string[],
): ConnectionResilienceState {
  const ids = new Set(eventIds);
  return {
    ...state,
    bufferedEvents: state.bufferedEvents.filter((event) => !ids.has(event.id)),
  };
}

export function buildConflictToast(
  message: string,
  level: ConflictToast['level'] = 'warning',
  now: Date = new Date(),
): ConflictToast {
  return {
    id: `toast_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    level,
    title: level === 'error' ? 'Sync error' : 'Collaboration update',
    message,
    createdAt: now,
  };
}

export function pushToast(
  state: ConnectionResilienceState,
  toast: ConflictToast,
  maxToasts: number = 5,
): ConnectionResilienceState {
  return {
    ...state,
    toasts: [...state.toasts, toast].slice(-maxToasts),
  };
}

export function shouldQueueWhileOffline(status: ConnectionStatus): boolean {
  return status === 'disconnected' || status === 'reconnecting' || status === 'error';
}

export function buildReconnectSummary(
  state: ConnectionResilienceState,
  now: Date = new Date(),
): {
  status: ConnectionStatus;
  bufferedCount: number;
  retryCount: number;
  nextRetryInMs: number | null;
  hasPendingToasts: boolean;
} {
  return {
    status: state.status,
    bufferedCount: state.bufferedEvents.length,
    retryCount: state.retryCount,
    nextRetryInMs: state.nextRetryAt ? Math.max(0, state.nextRetryAt.getTime() - now.getTime()) : null,
    hasPendingToasts: state.toasts.length > 0,
  };
}
