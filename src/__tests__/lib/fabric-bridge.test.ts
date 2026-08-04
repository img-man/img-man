// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for fabric-bridge coordinate mapping
 */
import { describe, it, expect } from 'vitest';
import { createCoordinateMapping } from '../../app/dashboard/tools/pdf-editor/engine/fabric-bridge';
import type { PageMeta } from '../../app/dashboard/tools/pdf-editor/types';

const page: PageMeta = { pageNumber: 1, width: 612, height: 792, rotation: 0 };

describe('fabric-bridge', () => {
  describe('createCoordinateMapping', () => {
    it('creates a mapping with correct scale', () => {
      const mapping = createCoordinateMapping(page, 1.0, 1);
      expect(mapping.scale).toBe(1.0);
    });

    it('scales up at zoom 2x', () => {
      const mapping = createCoordinateMapping(page, 2.0, 1);
      expect(mapping.scale).toBe(2.0);
    });

    it('screenToPdf converts correctly at 1x zoom', () => {
      const mapping = createCoordinateMapping(page, 1.0, 1);

      const pdf = mapping.screenToPdf(100, 200);
      // At 1x zoom with dpr=1, screen coords equal PDF points
      expect(pdf.x).toBeCloseTo(100, 1);
      expect(pdf.y).toBeCloseTo(200, 1);
    });

    it('screenToPdf correctly scales at 2x zoom', () => {
      const mapping = createCoordinateMapping(page, 2.0, 1);

      const pdf = mapping.screenToPdf(200, 400);
      // At 2x zoom, 200 screen pixels = 100 PDF points
      expect(pdf.x).toBeCloseTo(100, 1);
      expect(pdf.y).toBeCloseTo(200, 1);
    });

    it('pdfToScreen inverts screenToPdf', () => {
      const mapping = createCoordinateMapping(page, 1.5, 2);

      const pdfPoint = { x: 100, y: 200 };
      const screen = mapping.pdfToScreen(pdfPoint.x, pdfPoint.y);
      const roundTrip = mapping.screenToPdf(screen.x, screen.y);

      expect(roundTrip.x).toBeCloseTo(pdfPoint.x, 1);
      expect(roundTrip.y).toBeCloseTo(pdfPoint.y, 1);
    });
  });
});
