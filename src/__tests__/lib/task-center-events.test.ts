// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredUploadTasks,
  publishUploadTasks,
  subscribeToUploadTasks,
  clearStoredUploadTasks,
  type TaskUploadSnapshot,
} from '@/lib/task-center-events';

const makeTask = (id: string, status: TaskUploadSnapshot['status'] = 'uploading'): TaskUploadSnapshot => ({
  id,
  name: `file-${id}.jpg`,
  status,
  progress: 50,
});

describe('task-center-events (jsdom)', () => {
  beforeEach(() => {
    // Clear session storage before each test
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe('readStoredUploadTasks', () => {
    it('returns empty array when nothing stored', () => {
      expect(readStoredUploadTasks()).toEqual([]);
    });

    it('returns stored tasks', () => {
      const tasks = [makeTask('1'), makeTask('2')];
      window.sessionStorage.setItem(
        'imageman.taskCenter.uploads',
        JSON.stringify(tasks),
      );
      expect(readStoredUploadTasks()).toHaveLength(2);
    });

    it('returns empty array on malformed JSON', () => {
      window.sessionStorage.setItem('imageman.taskCenter.uploads', 'not-json{{');
      expect(readStoredUploadTasks()).toEqual([]);
    });

    it('returns empty array if stored value is not an array', () => {
      window.sessionStorage.setItem('imageman.taskCenter.uploads', JSON.stringify({ a: 1 }));
      expect(readStoredUploadTasks()).toEqual([]);
    });
  });

  describe('publishUploadTasks', () => {
    it('persists tasks to session storage', () => {
      const tasks = [makeTask('a'), makeTask('b')];
      publishUploadTasks(tasks);
      const stored = readStoredUploadTasks();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe('a');
      expect(stored[1].id).toBe('b');
    });

    it('caps stored tasks at 12', () => {
      const tasks = Array.from({ length: 20 }, (_, i) => makeTask(String(i)));
      publishUploadTasks(tasks);
      expect(readStoredUploadTasks()).toHaveLength(12);
    });

    it('dispatches a custom event', () => {
      const handler = vi.fn();
      window.addEventListener('imageman:task-center-uploads', handler);
      publishUploadTasks([makeTask('x')]);
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('imageman:task-center-uploads', handler);
    });

    it('publishes empty array', () => {
      publishUploadTasks([]);
      expect(readStoredUploadTasks()).toEqual([]);
    });
  });

  describe('subscribeToUploadTasks', () => {
    it('calls listener when tasks are published', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToUploadTasks(listener);
      const tasks = [makeTask('sub-1')];
      publishUploadTasks(tasks);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(tasks);
      unsubscribe();
    });

    it('returns an unsubscribe function that stops listener', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToUploadTasks(listener);
      unsubscribe();
      publishUploadTasks([makeTask('after-unsub')]);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('clearStoredUploadTasks', () => {
    it('removes tasks from session storage', () => {
      publishUploadTasks([makeTask('c1'), makeTask('c2')]);
      expect(readStoredUploadTasks()).toHaveLength(2);
      clearStoredUploadTasks();
      expect(readStoredUploadTasks()).toHaveLength(0);
    });

    it('dispatches event with empty array on clear', () => {
      const listener = vi.fn();
      subscribeToUploadTasks(listener);
      clearStoredUploadTasks();
      expect(listener).toHaveBeenCalledWith([]);
    });
  });
});
