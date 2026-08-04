// SPDX-License-Identifier: Apache-2.0
/**
 * useAnnotations Hook
 *
 * Manages the global annotation state across all pages.
 * Provides CRUD operations and integrates with undo/redo.
 */

'use client';

import { useState, useCallback } from 'react';
import type { Annotation } from '../types';
import {
  createAddCommand,
  createRemoveCommand,
  createModifyCommand,
  pushCommand,
} from '../engine/command-stack';
import type { Command } from '../types';

export interface UseAnnotationsReturn {
  /** All annotations organized by page */
  annotations: Map<number, Annotation[]>;
  /** Get annotations for a specific page */
  getPageAnnotations: (page: number) => Annotation[];
  /** Get total annotation count across all pages */
  totalCount: number;
  /** Add an annotation */
  addAnnotation: (annotation: Annotation) => void;
  /** Remove an annotation by ID */
  removeAnnotation: (page: number, annotationId: string) => void;
  /** Update annotation properties */
  updateAnnotation: (
    page: number,
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void;
  /** Find an annotation by ID across all pages */
  findAnnotation: (
    annotationId: string,
  ) => { page: number; annotation: Annotation } | null;
  /** Clear all annotations */
  clearAll: () => void;
  /** Set bulk annotations (e.g., from deserialization) */
  setAnnotations: (annotations: Map<number, Annotation[]>) => void;
  /** Undo stack */
  undoStack: Command[];
  /** Redo stack */
  redoStack: Command[];
  /** Perform undo */
  undo: () => void;
  /** Perform redo */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Map<number, Annotation[]>>(
    new Map(),
  );
  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);

  const getPageAnnotations = useCallback(
    (page: number): Annotation[] => {
      return annotations.get(page) ?? [];
    },
    [annotations],
  );

  const totalCount = Array.from(annotations.values()).reduce(
    (sum, anns) => sum + anns.length,
    0,
  );

  const addAnnotation = useCallback(
    (annotation: Annotation) => {
      setAnnotations((prev) => {
        const newMap = new Map(prev);
        const pageAnns = [...(newMap.get(annotation.page) ?? []), annotation];
        newMap.set(annotation.page, pageAnns);
        return newMap;
      });

      // Push to undo stack
      const cmd = createAddCommand(annotation.page, annotation);
      const result = pushCommand(undoStack, cmd);
      setUndoStack(result.undoStack);
      setRedoStack(result.redoStack);
    },
    [undoStack],
  );

  const removeAnnotation = useCallback(
    (page: number, annotationId: string) => {
      let removedAnnotation: Annotation | undefined;

      setAnnotations((prev) => {
        const newMap = new Map(prev);
        const pageAnns = newMap.get(page) ?? [];
        removedAnnotation = pageAnns.find((a) => a.id === annotationId);
        newMap.set(
          page,
          pageAnns.filter((a) => a.id !== annotationId),
        );
        return newMap;
      });

      // Push to undo stack
      if (removedAnnotation) {
        const cmd = createRemoveCommand(page, removedAnnotation);
        const result = pushCommand(undoStack, cmd);
        setUndoStack(result.undoStack);
        setRedoStack(result.redoStack);
      }
    },
    [undoStack],
  );

  const updateAnnotation = useCallback(
    (page: number, annotationId: string, updates: Partial<Annotation>) => {
      let before: Partial<Annotation> = {};

      setAnnotations((prev) => {
        const newMap = new Map(prev);
        const pageAnns = newMap.get(page) ?? [];
        const idx = pageAnns.findIndex((a) => a.id === annotationId);
        if (idx === -1) return prev;

        const existing = pageAnns[idx];
        // Capture before state
        before = {};
        for (const key of Object.keys(updates)) {
          (before as Record<string, unknown>)[key] = (
            existing as unknown as Record<string, unknown>
          )[key];
        }

        const updated = { ...existing, ...updates } as Annotation;
        const newAnns = [...pageAnns];
        newAnns[idx] = updated;
        newMap.set(page, newAnns);
        return newMap;
      });

      // Push to undo stack
      if (Object.keys(before).length > 0) {
        const cmd = createModifyCommand(page, annotationId, before, updates);
        const result = pushCommand(undoStack, cmd);
        setUndoStack(result.undoStack);
        setRedoStack(result.redoStack);
      }
    },
    [undoStack],
  );

  const findAnnotation = useCallback(
    (annotationId: string): { page: number; annotation: Annotation } | null => {
      for (const [page, anns] of annotations) {
        const found = anns.find((a) => a.id === annotationId);
        if (found) return { page, annotation: found };
      }
      return null;
    },
    [annotations],
  );

  const clearAll = useCallback(() => {
    setAnnotations(new Map());
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const newUndo = [...undoStack];
    const cmd = newUndo.pop()!;

    setAnnotations((prev) => {
      const newMap = new Map(prev);

      switch (cmd.type) {
        case 'add-annotation': {
          const { page, annotation } = cmd.after as {
            page: number;
            annotation: Annotation;
          };
          const pageAnns = newMap.get(page) ?? [];
          newMap.set(
            page,
            pageAnns.filter((a) => a.id !== annotation.id),
          );
          break;
        }
        case 'remove-annotation': {
          const { page, annotation } = cmd.before as {
            page: number;
            annotation: Annotation;
          };
          const pageAnns = [...(newMap.get(page) ?? []), annotation];
          newMap.set(page, pageAnns);
          break;
        }
        case 'modify-annotation':
        case 'move-annotation':
        case 'resize-annotation': {
          const { page, annotationId, ...beforeProps } = cmd.before as {
            page: number;
            annotationId: string;
            props?: Record<string, unknown>;
          };
          const props =
            (cmd.before as { props?: Record<string, unknown> }).props ??
            beforeProps;
          const pageAnns = newMap.get(page) ?? [];
          const idx = pageAnns.findIndex((a) => a.id === annotationId);
          if (idx !== -1) {
            const newAnns = [...pageAnns];
            newAnns[idx] = Object.assign({}, newAnns[idx], props) as Annotation;
            newMap.set(page, newAnns);
          }
          break;
        }
      }

      return newMap;
    });

    setUndoStack(newUndo);
    setRedoStack((prev) => [...prev, cmd]);
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const newRedo = [...redoStack];
    const cmd = newRedo.pop()!;

    setAnnotations((prev) => {
      const newMap = new Map(prev);

      switch (cmd.type) {
        case 'add-annotation': {
          const { page, annotation } = cmd.after as {
            page: number;
            annotation: Annotation;
          };
          const pageAnns = [...(newMap.get(page) ?? []), annotation];
          newMap.set(page, pageAnns);
          break;
        }
        case 'remove-annotation': {
          const { page, annotation } = cmd.before as {
            page: number;
            annotation: Annotation;
          };
          const pageAnns = newMap.get(page) ?? [];
          newMap.set(
            page,
            pageAnns.filter((a) => a.id !== annotation.id),
          );
          break;
        }
        case 'modify-annotation':
        case 'move-annotation':
        case 'resize-annotation': {
          const { page, annotationId } = cmd.after as {
            page: number;
            annotationId: string;
          };
          const props =
            (cmd.after as { props?: Record<string, unknown> }).props ??
            cmd.after;
          const pageAnns = newMap.get(page) ?? [];
          const idx = pageAnns.findIndex((a) => a.id === annotationId);
          if (idx !== -1) {
            const newAnns = [...pageAnns];
            newAnns[idx] = Object.assign({}, newAnns[idx], props) as Annotation;
            newMap.set(page, newAnns);
          }
          break;
        }
      }

      return newMap;
    });

    setRedoStack(newRedo);
    setUndoStack((prev) => [...prev, cmd]);
  }, [redoStack]);

  return {
    annotations,
    getPageAnnotations,
    totalCount,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    findAnnotation,
    clearAll,
    setAnnotations,
    undoStack,
    redoStack,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
