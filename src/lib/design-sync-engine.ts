// SPDX-License-Identifier: Apache-2.0
/**
 * Design Sync Engine — Sprint 17.1/17.4
 *
 * Pure helpers for collaborative design operations, deterministic
 * ordering, conflict detection, and conflict-resolution-friendly rebasing.
 */

import type {
  DesignElement,
  DesignPage,
  DesignState,
} from '@/components/design/editor-types';

export type SyncOperationType =
  | 'add_element'
  | 'update_element'
  | 'remove_element'
  | 'move_element'
  | 'reorder_element'
  | 'set_background'
  | 'add_page'
  | 'remove_page'
  | 'switch_page';

export interface DesignSyncOperation {
  opId: string;
  sessionId: string;
  designId: string;
  collaboratorId: string;
  lamport: number;
  baseVersion: number;
  type: SyncOperationType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface SyncConflict {
  kind: 'same-target' | 'missing-target' | 'page-mismatch';
  opIds: string[];
  targetId: string | null;
  message: string;
}

export interface SyncSnapshot {
  version: number;
  operationCount: number;
  pageCount: number;
  elementCount: number;
  capturedAt: Date;
}

export interface OperationSummary {
  opId: string;
  type: SyncOperationType;
  collaboratorId: string;
  label: string;
}

export function createSyncOperation(
  input: Omit<DesignSyncOperation, 'opId' | 'createdAt'> & { opId?: string },
  now: Date = new Date(),
): DesignSyncOperation {
  return {
    ...input,
    opId: input.opId ?? `op_${input.collaboratorId}_${input.lamport}_${now.getTime()}`,
    createdAt: now,
  };
}

function resolveCurrentPageIndex(state: DesignState): number {
  if (!state.pages || state.pages.length === 0) return -1;
  return Math.max(0, Math.min(state.currentPageIndex ?? 0, state.pages.length - 1));
}

function getElementList(state: DesignState, pageId?: string): DesignElement[] {
  if (!state.pages || state.pages.length === 0) return state.elements;
  if (pageId) {
    return state.pages.find((page) => page.id === pageId)?.elements ?? [];
  }
  return state.pages[resolveCurrentPageIndex(state)]?.elements ?? [];
}

function updateElementList(
  state: DesignState,
  nextElements: DesignElement[],
  pageId?: string,
): DesignState {
  if (!state.pages || state.pages.length === 0) {
    return { ...state, elements: nextElements };
  }

  const resolvedPageId = pageId ?? state.pages[resolveCurrentPageIndex(state)]?.id;
  return {
    ...state,
    pages: state.pages.map((page) =>
      page.id === resolvedPageId ? { ...page, elements: nextElements } : page,
    ),
  };
}

function toPatchedElement(
  element: DesignElement,
  patch: Record<string, unknown>,
): DesignElement {
  return {
    ...element,
    ...patch,
  } as DesignElement;
}

export function applySyncOperation(
  state: DesignState,
  operation: DesignSyncOperation,
): DesignState {
  switch (operation.type) {
    case 'add_element': {
      const pageId = operation.payload.pageId as string | undefined;
      const element = operation.payload.element as DesignElement;
      return updateElementList(state, [...getElementList(state, pageId), element], pageId);
    }
    case 'update_element': {
      const pageId = operation.payload.pageId as string | undefined;
      const elementId = operation.payload.elementId as string;
      const patch = (operation.payload.patch ?? {}) as Record<string, unknown>;
      return updateElementList(
        state,
        getElementList(state, pageId).map((element) =>
          element.id === elementId ? toPatchedElement(element, patch) : element,
        ),
        pageId,
      );
    }
    case 'remove_element': {
      const pageId = operation.payload.pageId as string | undefined;
      const elementId = operation.payload.elementId as string;
      return updateElementList(
        state,
        getElementList(state, pageId).filter((element) => element.id !== elementId),
        pageId,
      );
    }
    case 'move_element': {
      const pageId = operation.payload.pageId as string | undefined;
      const elementId = operation.payload.elementId as string;
      const x = operation.payload.x as number;
      const y = operation.payload.y as number;
      return updateElementList(
        state,
        getElementList(state, pageId).map((element) =>
          element.id === elementId ? { ...element, x, y } : element,
        ),
        pageId,
      );
    }
    case 'reorder_element': {
      const pageId = operation.payload.pageId as string | undefined;
      const elementId = operation.payload.elementId as string;
      const toIndex = operation.payload.toIndex as number;
      const list = [...getElementList(state, pageId)];
      const fromIndex = list.findIndex((element) => element.id === elementId);
      if (fromIndex === -1) return state;
      const [item] = list.splice(fromIndex, 1);
      list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, item);
      return updateElementList(state, list, pageId);
    }
    case 'set_background': {
      const pageId = operation.payload.pageId as string | undefined;
      const background = operation.payload.background as string;
      if (!state.pages || state.pages.length === 0 || !pageId) {
        return { ...state, background };
      }
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === pageId ? { ...page, background } : page,
        ),
      };
    }
    case 'add_page': {
      const page = operation.payload.page as DesignPage;
      const pages = state.pages ? [...state.pages, page] : [page];
      return {
        ...state,
        pages,
        currentPageIndex: pages.length - 1,
      };
    }
    case 'remove_page': {
      if (!state.pages || state.pages.length === 0) return state;
      const pageId = operation.payload.pageId as string;
      const pages = state.pages.filter((page) => page.id !== pageId);
      return {
        ...state,
        pages,
        currentPageIndex: pages.length === 0 ? 0 : Math.min(state.currentPageIndex ?? 0, pages.length - 1),
      };
    }
    case 'switch_page': {
      const pageId = operation.payload.pageId as string;
      const nextIndex = state.pages?.findIndex((page) => page.id === pageId) ?? -1;
      if (nextIndex < 0) return state;
      return {
        ...state,
        currentPageIndex: nextIndex,
      };
    }
    default:
      return state;
  }
}

export function sortSyncOperations(operations: DesignSyncOperation[]): DesignSyncOperation[] {
  return [...operations].sort((left, right) => {
    const lamportDelta = left.lamport - right.lamport;
    if (lamportDelta !== 0) return lamportDelta;
    const timeDelta = left.createdAt.getTime() - right.createdAt.getTime();
    if (timeDelta !== 0) return timeDelta;
    return left.opId.localeCompare(right.opId);
  });
}

export function dedupeSyncOperations(operations: DesignSyncOperation[]): DesignSyncOperation[] {
  const seen = new Set<string>();
  const result: DesignSyncOperation[] = [];
  for (const operation of sortSyncOperations(operations)) {
    if (seen.has(operation.opId)) continue;
    seen.add(operation.opId);
    result.push(operation);
  }
  return result;
}

function operationTargetKey(operation: DesignSyncOperation): string | null {
  const elementId = operation.payload.elementId as string | undefined;
  const pageId = operation.payload.pageId as string | undefined;
  if (elementId) return `element:${pageId ?? 'default'}:${elementId}`;
  if (pageId && (operation.type === 'set_background' || operation.type === 'remove_page' || operation.type === 'switch_page')) {
    return `page:${pageId}`;
  }
  return null;
}

export function detectSyncConflicts(operations: DesignSyncOperation[]): SyncConflict[] {
  const conflicts: SyncConflict[] = [];
  const byTarget = new Map<string, DesignSyncOperation[]>();

  for (const operation of operations) {
    const key = operationTargetKey(operation);
    if (!key) continue;
    const existing = byTarget.get(key) ?? [];
    existing.push(operation);
    byTarget.set(key, existing);
  }

  for (const [key, items] of byTarget.entries()) {
    if (items.length < 2) continue;
    const collabIds = new Set(items.map((item) => item.collaboratorId));
    if (collabIds.size < 2) continue;
    conflicts.push({
      kind: 'same-target',
      opIds: items.map((item) => item.opId),
      targetId: key,
      message: `Multiple collaborators updated ${key}`,
    });
  }

  return conflicts;
}

export function resolveSyncConflicts(
  operations: DesignSyncOperation[],
  strategy: 'last_write_wins' | 'first_write_wins' = 'last_write_wins',
): DesignSyncOperation[] {
  const grouped = new Map<string, DesignSyncOperation[]>();
  const passThrough: DesignSyncOperation[] = [];

  for (const operation of dedupeSyncOperations(operations)) {
    const key = operationTargetKey(operation);
    if (!key) {
      passThrough.push(operation);
      continue;
    }
    const existing = grouped.get(key) ?? [];
    existing.push(operation);
    grouped.set(key, existing);
  }

  const resolved: DesignSyncOperation[] = [...passThrough];
  for (const items of grouped.values()) {
    if (items.length === 1) {
      resolved.push(items[0]);
      continue;
    }
    const sorted = sortSyncOperations(items);
    resolved.push(strategy === 'last_write_wins' ? sorted[sorted.length - 1] : sorted[0]);
  }

  return sortSyncOperations(resolved);
}

export function applySyncOperations(
  state: DesignState,
  operations: DesignSyncOperation[],
): DesignState {
  return resolveSyncConflicts(operations).reduce(applySyncOperation, state);
}

export function rebasePendingSyncOperations(
  baseState: DesignState,
  acknowledgedOperations: DesignSyncOperation[],
  pendingOperations: DesignSyncOperation[],
): { rebasedState: DesignState; pending: DesignSyncOperation[] } {
  const acknowledged = dedupeSyncOperations(acknowledgedOperations);
  const pending = dedupeSyncOperations(pendingOperations).filter(
    (operation) => !acknowledged.some((ack) => ack.opId === operation.opId),
  );

  const rebasedState = [...acknowledged, ...pending].reduce(applySyncOperation, baseState);
  return { rebasedState, pending };
}

export function buildSyncSnapshot(
  state: DesignState,
  version: number,
  operations: DesignSyncOperation[],
  now: Date = new Date(),
): SyncSnapshot {
  const elementCount = state.pages && state.pages.length > 0
    ? state.pages.reduce((count, page) => count + page.elements.length, 0)
    : state.elements.length;

  return {
    version,
    operationCount: dedupeSyncOperations(operations).length,
    pageCount: state.pages?.length ?? 1,
    elementCount,
    capturedAt: now,
  };
}

export function summarizeSyncOperation(operation: DesignSyncOperation): OperationSummary {
  const labels: Record<SyncOperationType, string> = {
    add_element: 'Added element',
    update_element: 'Updated element',
    remove_element: 'Removed element',
    move_element: 'Moved element',
    reorder_element: 'Reordered element',
    set_background: 'Changed background',
    add_page: 'Added page',
    remove_page: 'Removed page',
    switch_page: 'Switched page',
  };

  return {
    opId: operation.opId,
    type: operation.type,
    collaboratorId: operation.collaboratorId,
    label: labels[operation.type],
  };
}
