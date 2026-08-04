// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for command-stack engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAddCommand,
  createRemoveCommand,
  createModifyCommand,
  createMoveCommand,
  createResizeCommand,
  pushCommand,
  popUndo,
  popRedo,
  canUndo,
  canRedo,
} from '../../app/dashboard/tools/pdf-editor/engine/command-stack';
import type { TextAnnotation } from '../../app/dashboard/tools/pdf-editor/types';

function makeAnnotation(id = 'ann-1'): TextAnnotation {
  return {
    id,
    kind: 'text',
    page: 1,
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: 'Hello',
    fontFamily: 'Helvetica',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#000000',
  };
}

describe('command-stack', () => {
  describe('createAddCommand', () => {
    it('creates an add-annotation command', () => {
      const ann = makeAnnotation();
      const cmd = createAddCommand(1, ann);
      expect(cmd.type).toBe('add-annotation');
      expect(cmd.before).toBeNull();
      expect(cmd.after).toEqual({ page: 1, annotation: ann });
      expect(cmd.targetId).toBe(ann.id);
      expect(cmd.timestamp).toBeGreaterThan(0);
    });

    it('deep-clones the annotation (no shared references)', () => {
      const ann = makeAnnotation();
      const cmd = createAddCommand(1, ann);
      ann.text = 'Modified';
      expect(
        (cmd.after as { annotation: TextAnnotation }).annotation.text,
      ).toBe('Hello');
    });
  });

  describe('createRemoveCommand', () => {
    it('creates a remove-annotation command', () => {
      const ann = makeAnnotation();
      const cmd = createRemoveCommand(1, ann);
      expect(cmd.type).toBe('remove-annotation');
      expect(cmd.before).toEqual({ page: 1, annotation: ann });
      expect(cmd.after).toBeNull();
      expect(cmd.targetId).toBe(ann.id);
    });
  });

  describe('createModifyCommand', () => {
    it('stores before/after property snapshots', () => {
      const cmd = createModifyCommand(1, 'ann-1', { x: 10 }, { x: 50 });
      expect(cmd.type).toBe('modify-annotation');
      expect(cmd.before).toEqual({
        page: 1,
        annotationId: 'ann-1',
        props: { x: 10 },
      });
      expect(cmd.after).toEqual({
        page: 1,
        annotationId: 'ann-1',
        props: { x: 50 },
      });
    });
  });

  describe('createMoveCommand', () => {
    it('stores before/after positions', () => {
      const cmd = createMoveCommand(
        1,
        'ann-1',
        { x: 0, y: 0 },
        { x: 100, y: 200 },
      );
      expect(cmd.type).toBe('move-annotation');
      expect((cmd.before as { x: number }).x).toBe(0);
      expect((cmd.after as { x: number }).x).toBe(100);
    });
  });

  describe('createResizeCommand', () => {
    it('stores full bounds', () => {
      const before = { x: 0, y: 0, width: 100, height: 50 };
      const after = { x: 0, y: 0, width: 200, height: 100 };
      const cmd = createResizeCommand(1, 'ann-1', before, after);
      expect(cmd.type).toBe('resize-annotation');
      expect((cmd.after as { width: number }).width).toBe(200);
    });
  });

  describe('pushCommand', () => {
    it('adds a command to the undo stack', () => {
      const cmd = createAddCommand(1, makeAnnotation());
      const result = pushCommand([], cmd);
      expect(result.undoStack).toHaveLength(1);
      expect(result.undoStack[0]).toBe(cmd);
    });

    it('clears the redo stack', () => {
      const cmd1 = createAddCommand(1, makeAnnotation('a'));
      const cmd2 = createAddCommand(1, makeAnnotation('b'));
      const result = pushCommand([], cmd1);
      const result2 = pushCommand(result.undoStack, cmd2);
      expect(result2.redoStack).toHaveLength(0);
    });

    it('trims to MAX_UNDO_STACK', () => {
      let stack: ReturnType<typeof pushCommand> = {
        undoStack: [],
        redoStack: [],
      };
      for (let i = 0; i < 120; i++) {
        const cmd = createAddCommand(1, makeAnnotation(`ann-${i}`));
        stack = pushCommand(stack.undoStack, cmd);
      }
      expect(stack.undoStack.length).toBeLessThanOrEqual(100);
    });
  });

  describe('popUndo / popRedo', () => {
    it('pops from undo and pushes to redo', () => {
      const cmd = createAddCommand(1, makeAnnotation());
      const { undoStack } = pushCommand([], cmd);

      const result = popUndo(undoStack, []);
      expect(result.command).toBe(cmd);
      expect(result.undoStack).toHaveLength(0);
      expect(result.redoStack).toHaveLength(1);
    });

    it('pops from redo and pushes to undo', () => {
      const cmd = createAddCommand(1, makeAnnotation());
      const { undoStack } = pushCommand([], cmd);
      const afterUndo = popUndo(undoStack, []);

      const result = popRedo(afterUndo.undoStack, afterUndo.redoStack);
      expect(result.command).toBe(cmd);
      expect(result.undoStack).toHaveLength(1);
      expect(result.redoStack).toHaveLength(0);
    });

    it('returns null if undo stack is empty', () => {
      const result = popUndo([], []);
      expect(result.command).toBeNull();
    });

    it('returns null if redo stack is empty', () => {
      const result = popRedo([], []);
      expect(result.command).toBeNull();
    });
  });

  describe('canUndo / canRedo', () => {
    it('returns false for empty stacks', () => {
      expect(canUndo([])).toBe(false);
      expect(canRedo([])).toBe(false);
    });

    it('returns true for non-empty stacks', () => {
      const cmd = createAddCommand(1, makeAnnotation());
      expect(canUndo([cmd])).toBe(true);
      expect(canRedo([cmd])).toBe(true);
    });
  });
});
