// SPDX-License-Identifier: Apache-2.0
/**
 * Command Stack Engine (Undo/Redo)
 *
 * Implements the Command pattern for reversible operations.
 * Each command stores before/after snapshots for full undo/redo.
 */

import type { Command, CommandType, Annotation } from '../types';
import { MAX_UNDO_STACK } from '../constants';

/* ──────────────────────── Command Creators ──────────────────────── */

let _commandId = 0;
function nextId() {
  return `cmd-${++_commandId}-${Date.now()}`;
}

/**
 * Create an "add annotation" command.
 */
export function createAddCommand(
  page: number,
  annotation: Annotation,
): Command {
  return {
    type: 'add-annotation' as CommandType,
    timestamp: Date.now(),
    before: null,
    after: { page, annotation: structuredClone(annotation) },
    targetId: annotation.id,
  };
}

/**
 * Create a "remove annotation" command.
 */
export function createRemoveCommand(
  page: number,
  annotation: Annotation,
): Command {
  return {
    type: 'remove-annotation' as CommandType,
    timestamp: Date.now(),
    before: { page, annotation: structuredClone(annotation) },
    after: null,
    targetId: annotation.id,
  };
}

/**
 * Create a "modify annotation" command (for property changes).
 */
export function createModifyCommand(
  page: number,
  annotationId: string,
  before: Partial<Annotation>,
  after: Partial<Annotation>,
): Command {
  return {
    type: 'modify-annotation' as CommandType,
    timestamp: Date.now(),
    before: { page, annotationId, props: structuredClone(before) },
    after: { page, annotationId, props: structuredClone(after) },
    targetId: annotationId,
  };
}

/**
 * Create a "move annotation" command.
 */
export function createMoveCommand(
  page: number,
  annotationId: string,
  beforePos: { x: number; y: number },
  afterPos: { x: number; y: number },
): Command {
  return {
    type: 'move-annotation' as CommandType,
    timestamp: Date.now(),
    before: { page, annotationId, ...beforePos },
    after: { page, annotationId, ...afterPos },
    targetId: annotationId,
  };
}

/**
 * Create a "resize annotation" command.
 */
export function createResizeCommand(
  page: number,
  annotationId: string,
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number },
): Command {
  return {
    type: 'resize-annotation' as CommandType,
    timestamp: Date.now(),
    before: { page, annotationId, ...before },
    after: { page, annotationId, ...after },
    targetId: annotationId,
  };
}

/* ──────────────────────── Stack Management ──────────────────────── */

/**
 * Push a command onto the undo stack.
 * Clears the redo stack (no branching history).
 * Enforces max stack size.
 */
export function pushCommand(
  undoStack: Command[],
  command: Command,
): { undoStack: Command[]; redoStack: Command[] } {
  const newUndo = [...undoStack, command];

  // Trim if over limit
  if (newUndo.length > MAX_UNDO_STACK) {
    newUndo.splice(0, newUndo.length - MAX_UNDO_STACK);
  }

  return {
    undoStack: newUndo,
    redoStack: [], // Clear redo on new action
  };
}

/**
 * Pop the most recent command for undo.
 * Returns the command and updated stacks.
 */
export function popUndo(
  undoStack: Command[],
  redoStack: Command[],
): { command: Command | null; undoStack: Command[]; redoStack: Command[] } {
  if (undoStack.length === 0) {
    return { command: null, undoStack, redoStack };
  }

  const newUndo = [...undoStack];
  const command = newUndo.pop()!;

  return {
    command,
    undoStack: newUndo,
    redoStack: [...redoStack, command],
  };
}

/**
 * Pop the most recent command for redo.
 * Returns the command and updated stacks.
 */
export function popRedo(
  undoStack: Command[],
  redoStack: Command[],
): { command: Command | null; undoStack: Command[]; redoStack: Command[] } {
  if (redoStack.length === 0) {
    return { command: null, undoStack, redoStack };
  }

  const newRedo = [...redoStack];
  const command = newRedo.pop()!;

  return {
    command,
    undoStack: [...undoStack, command],
    redoStack: newRedo,
  };
}

/**
 * Check if undo is available.
 */
export function canUndo(undoStack: Command[]): boolean {
  return undoStack.length > 0;
}

/**
 * Check if redo is available.
 */
export function canRedo(redoStack: Command[]): boolean {
  return redoStack.length > 0;
}
