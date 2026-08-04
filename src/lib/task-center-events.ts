// SPDX-License-Identifier: Apache-2.0
'use client';

export type TaskUploadStatus = 'queued' | 'uploading' | 'confirming' | 'done' | 'error';

export interface TaskUploadSnapshot {
  id: string;
  name: string;
  status: TaskUploadStatus;
  progress: number;
  error?: string;
}

const STORAGE_KEY = 'imageman.taskCenter.uploads';
const EVENT_NAME = 'imageman:task-center-uploads';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function readStoredUploadTasks(): TaskUploadSnapshot[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskUploadSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function publishUploadTasks(tasks: TaskUploadSnapshot[]) {
  if (!canUseStorage()) return;

  const normalized = tasks.slice(0, 12);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent<TaskUploadSnapshot[]>(EVENT_NAME, {
      detail: normalized,
    }),
  );
}

export function subscribeToUploadTasks(
  listener: (tasks: TaskUploadSnapshot[]) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<TaskUploadSnapshot[]>).detail;
    listener(Array.isArray(detail) ? detail : readStoredUploadTasks());
  };

  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}

export function clearStoredUploadTasks() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent<TaskUploadSnapshot[]>(EVENT_NAME, { detail: [] }),
  );
}
