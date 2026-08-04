// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for annotation-serializer engine
 */
import { describe, it, expect } from 'vitest';
import {
  generateAnnotationId,
  createTextAnnotation,
  createImageAnnotation,
  createSignatureAnnotation,
  createShapeAnnotation,
  createHighlightAnnotation,
  createWhiteoutAnnotation,
  serializeAnnotations,
  deserializeAnnotations,
} from '../../app/dashboard/tools/pdf-editor/engine/annotation-serializer';
import type { Annotation } from '../../app/dashboard/tools/pdf-editor/types';

describe('annotation-serializer', () => {
  describe('generateAnnotationId', () => {
    it('returns unique IDs', () => {
      const id1 = generateAnnotationId();
      const id2 = generateAnnotationId();
      expect(id1).not.toBe(id2);
    });

    it('starts with "ann-" prefix', () => {
      expect(generateAnnotationId()).toMatch(/^ann-/);
    });
  });

  describe('createTextAnnotation', () => {
    it('creates with defaults', () => {
      const ann = createTextAnnotation(1, 50, 100);
      expect(ann.kind).toBe('text');
      expect(ann.page).toBe(1);
      expect(ann.x).toBe(50);
      expect(ann.y).toBe(100);
      expect(ann.text).toBe('New text');
      expect(ann.fontFamily).toBe('Helvetica');
      expect(ann.fontSize).toBe(16);
      expect(ann.fontWeight).toBe('normal');
      expect(ann.fontStyle).toBe('normal');
      expect(ann.opacity).toBe(1);
    });

    it('applies overrides', () => {
      const ann = createTextAnnotation(2, 0, 0, {
        text: 'Custom',
        fontSize: 24,
        fontWeight: 'bold',
      });
      expect(ann.text).toBe('Custom');
      expect(ann.fontSize).toBe(24);
      expect(ann.fontWeight).toBe('bold');
    });
  });

  describe('createImageAnnotation', () => {
    it('creates with src and lock aspect', () => {
      const ann = createImageAnnotation(1, 0, 0, 'data:image/png;base64,...');
      expect(ann.kind).toBe('image');
      expect(ann.src).toBe('data:image/png;base64,...');
      expect(ann.lockAspect).toBe(true);
    });
  });

  describe('createSignatureAnnotation', () => {
    it('creates with signature data', () => {
      const ann = createSignatureAnnotation(1, 10, 20, 'data:sig', 'drawn');
      expect(ann.kind).toBe('signature');
      expect(ann.signatureType).toBe('drawn');
      expect(ann.data).toBe('data:sig');
    });
  });

  describe('createShapeAnnotation', () => {
    it('creates a rectangle', () => {
      const ann = createShapeAnnotation(1, 0, 0, 'rectangle');
      expect(ann.kind).toBe('shape');
      expect(ann.shapeType).toBe('rectangle');
      expect(ann.fill).toBe('transparent');
      expect(ann.stroke).toBe('#000000');
    });

    it('creates an ellipse with overrides', () => {
      const ann = createShapeAnnotation(1, 10, 10, 'ellipse', {
        fill: '#FF0000',
      });
      expect(ann.shapeType).toBe('ellipse');
      expect(ann.fill).toBe('#FF0000');
    });
  });

  describe('createHighlightAnnotation', () => {
    it('creates with yellow color and partial opacity', () => {
      const ann = createHighlightAnnotation(1, 0, 0, 100, 20);
      expect(ann.kind).toBe('highlight');
      expect(ann.color).toBe('#FFFF00');
      expect(ann.opacity).toBe(0.4);
    });
  });

  describe('createWhiteoutAnnotation', () => {
    it('creates with white color and full opacity', () => {
      const ann = createWhiteoutAnnotation(1, 0, 0, 100, 20);
      expect(ann.kind).toBe('whiteout');
      expect(ann.color).toBe('#FFFFFF');
      expect(ann.opacity).toBe(1);
    });
  });

  describe('serializeAnnotations / deserializeAnnotations', () => {
    it('round-trips annotations through JSON', () => {
      const map = new Map<number, Annotation[]>();
      map.set(1, [createTextAnnotation(1, 10, 20)]);
      map.set(2, [createShapeAnnotation(2, 0, 0, 'rectangle')]);

      const json = serializeAnnotations(map);
      const restored = deserializeAnnotations(json);

      expect(restored.size).toBe(2);
      expect(restored.get(1)).toHaveLength(1);
      expect(restored.get(1)![0].kind).toBe('text');
      expect(restored.get(2)).toHaveLength(1);
      expect(restored.get(2)![0].kind).toBe('shape');
    });

    it('strips originalFile from ImageAnnotation', () => {
      const map = new Map<number, Annotation[]>();
      const img = createImageAnnotation(1, 0, 0, 'data:png');
      // Simulate a File being attached (cast to bypass type check)
      (img as { originalFile?: File }).originalFile = new File([], 'test.png');
      map.set(1, [img]);

      const json = serializeAnnotations(map);
      expect(json).not.toContain('originalFile');

      const restored = deserializeAnnotations(json);
      const restoredImg = restored.get(1)![0];
      expect(restoredImg.kind).toBe('image');
      expect('originalFile' in restoredImg).toBe(false);
    });

    it('handles empty map', () => {
      const map = new Map<number, Annotation[]>();
      const json = serializeAnnotations(map);
      const restored = deserializeAnnotations(json);
      expect(restored.size).toBe(0);
    });
  });
});
