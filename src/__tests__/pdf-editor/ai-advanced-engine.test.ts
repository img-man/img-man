// SPDX-License-Identifier: Apache-2.0
/**
 * AI Advanced Engine — Phase 6 Tests
 *
 * Tests PII detection, auto-fill, NL editing, bookmark generation,
 * and smart crop functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetAiAdvancedIdCounters,
  buildPiiDetectionPrompt,
  parsePiiDetectionResponse,
  acceptPiiDetection,
  rejectPiiDetection,
  acceptAllPii,
  groupPiiByType,
  getPiiTypeColor,
  getPiiTypeLabel,
  buildAutofillPrompt,
  parseAutofillResponse,
  acceptSuggestion,
  rejectSuggestion,
  buildNlEditPrompt,
  createNlCommand,
  markCommandExecuting,
  markCommandCompleted,
  markCommandFailed,
  buildBookmarkGenerationPrompt,
  parseBookmarkResponse,
  sortBookmarks,
  buildSmartCropPrompt,
  parseSmartCropResponse,
  calculateTrimSavings,
} from '../../app/dashboard/tools/pdf-editor/engine/ai-advanced-engine';
import type {
  PiiDetection,
  SmartCropResult,
  GeneratedBookmark,
} from '../../app/dashboard/tools/pdf-editor/types';
import {
  AI_PII_CONFIDENCE_THRESHOLD,
  AI_AUTOFILL_CONFIDENCE_THRESHOLD,
  AI_BOOKMARK_CONFIDENCE_THRESHOLD,
  AI_SMART_CROP_PADDING,
} from '../../app/dashboard/tools/pdf-editor/constants';

describe('AI Advanced Engine (Phase 6)', () => {
  beforeEach(() => {
    resetAiAdvancedIdCounters();
  });

  /* ═══════ PII Detection ═══════ */
  describe('buildPiiDetectionPrompt', () => {
    it('builds system and user prompts from text blocks', () => {
      const { systemPrompt, userPrompt } = buildPiiDetectionPrompt(
        ['John Doe, SSN: 123-45-6789', 'Email: john@example.com'],
        3,
      );
      expect(systemPrompt).toContain('PII');
      expect(userPrompt).toContain('Page 3');
      expect(userPrompt).toContain('123-45-6789');
    });
  });

  describe('parsePiiDetectionResponse', () => {
    it('parses valid PII detections', () => {
      const raw = JSON.stringify([
        {
          text: '123-45-6789',
          type: 'ssn',
          x: 10,
          y: 20,
          width: 100,
          height: 12,
          confidence: 0.95,
        },
        {
          text: 'john@example.com',
          type: 'email',
          x: 10,
          y: 40,
          width: 150,
          height: 12,
          confidence: 0.92,
        },
      ]);
      const result = parsePiiDetectionResponse(raw, 1);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('ssn');
      expect(result[0].page).toBe(1);
      expect(result[0].accepted).toBe(false);
      expect(result[1].type).toBe('email');
    });

    it('filters out invalid PII types', () => {
      const raw = JSON.stringify([
        {
          text: 'secret',
          type: 'unknown-type',
          x: 0,
          y: 0,
          width: 50,
          height: 10,
          confidence: 0.9,
        },
      ]);
      const result = parsePiiDetectionResponse(raw, 1);
      expect(result).toHaveLength(0);
    });

    it('filters out low confidence detections', () => {
      const raw = JSON.stringify([
        {
          text: 'maybe-ssn',
          type: 'ssn',
          x: 0,
          y: 0,
          width: 50,
          height: 10,
          confidence: 0.1,
        },
      ]);
      const result = parsePiiDetectionResponse(raw, 1);
      expect(result).toHaveLength(0);
    });

    it('handles markdown-wrapped JSON', () => {
      const raw =
        '```json\n' +
        JSON.stringify([
          {
            text: '123-45-6789',
            type: 'ssn',
            x: 0,
            y: 0,
            width: 100,
            height: 12,
            confidence: 0.95,
          },
        ]) +
        '\n```';
      const result = parsePiiDetectionResponse(raw, 1);
      expect(result).toHaveLength(1);
    });

    it('returns empty for unparseable input', () => {
      expect(parsePiiDetectionResponse('not json at all', 1)).toEqual([]);
    });
  });

  describe('PII state management', () => {
    let detections: PiiDetection[];

    beforeEach(() => {
      const raw = JSON.stringify([
        {
          text: '123-45-6789',
          type: 'ssn',
          x: 0,
          y: 0,
          width: 100,
          height: 12,
          confidence: 0.95,
        },
        {
          text: 'john@test.com',
          type: 'email',
          x: 0,
          y: 20,
          width: 120,
          height: 12,
          confidence: 0.9,
        },
        {
          text: '555-0100',
          type: 'phone',
          x: 0,
          y: 40,
          width: 80,
          height: 12,
          confidence: 0.85,
        },
      ]);
      detections = parsePiiDetectionResponse(raw, 1);
    });

    it('accepts a single detection', () => {
      const updated = acceptPiiDetection(detections, detections[0].id);
      expect(updated[0].accepted).toBe(true);
      expect(updated[1].accepted).toBe(false);
    });

    it('rejects (removes) a detection', () => {
      const updated = rejectPiiDetection(detections, detections[1].id);
      expect(updated).toHaveLength(2);
      expect(updated.find((d) => d.id === detections[1].id)).toBeUndefined();
    });

    it('accepts all detections', () => {
      const updated = acceptAllPii(detections);
      expect(updated.every((d) => d.accepted)).toBe(true);
    });
  });

  describe('groupPiiByType / getPiiTypeColor / getPiiTypeLabel', () => {
    it('groups detections by type', () => {
      const raw = JSON.stringify([
        {
          text: 'a',
          type: 'ssn',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          confidence: 0.95,
        },
        {
          text: 'b',
          type: 'ssn',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          confidence: 0.9,
        },
        {
          text: 'c',
          type: 'email',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          confidence: 0.92,
        },
      ]);
      const detections = parsePiiDetectionResponse(raw, 1);
      const groups = groupPiiByType(detections);
      expect(groups['ssn']).toHaveLength(2);
      expect(groups['email']).toHaveLength(1);
    });

    it('returns a color for known PII types', () => {
      expect(getPiiTypeColor('ssn')).toMatch(/^#/);
      expect(getPiiTypeColor('email')).toMatch(/^#/);
    });

    it('returns a label for known PII types', () => {
      expect(getPiiTypeLabel('ssn')).toBeTruthy();
      expect(getPiiTypeLabel('email')).toBeTruthy();
    });

    it('falls back for unknown type', () => {
      expect(getPiiTypeColor('unknown' as never)).toMatch(/^#/);
      expect(getPiiTypeLabel('unknown' as never)).toBeTruthy();
    });
  });

  /* ═══════ Auto-fill ═══════ */
  describe('buildAutofillPrompt', () => {
    it('includes field descriptions and context', () => {
      const { systemPrompt, userPrompt } = buildAutofillPrompt(
        [{ id: 'name', label: 'Name', type: 'text' }],
        'This is a contract for John Doe.',
      );
      expect(systemPrompt).toContain('auto-fill');
      expect(userPrompt).toContain('Name');
      expect(userPrompt).toContain('John Doe');
    });
  });

  describe('parseAutofillResponse', () => {
    it('parses valid suggestions', () => {
      const raw = JSON.stringify([
        {
          fieldId: 'name',
          fieldLabel: 'Name',
          suggestedValue: 'John Doe',
          confidence: 0.95,
          source: 'context',
        },
      ]);
      const result = parseAutofillResponse(raw);
      expect(result).toHaveLength(1);
      expect(result[0].fieldId).toBe('name');
      expect(result[0].accepted).toBe(false);
    });

    it('filters below-threshold suggestions', () => {
      const raw = JSON.stringify([
        {
          fieldId: 'name',
          fieldLabel: 'Name',
          suggestedValue: 'Maybe?',
          confidence: 0.1,
          source: 'ai',
        },
      ]);
      expect(parseAutofillResponse(raw)).toHaveLength(0);
    });

    it('validates source to allowed values', () => {
      const raw = JSON.stringify([
        {
          fieldId: 'f1',
          fieldLabel: 'L1',
          suggestedValue: 'V1',
          confidence: 0.95,
          source: 'garbage',
        },
      ]);
      const result = parseAutofillResponse(raw);
      expect(result[0].source).toBe('ai'); // fallback
    });
  });

  describe('acceptSuggestion / rejectSuggestion', () => {
    it('accepts a suggestion by fieldId', () => {
      const raw = JSON.stringify([
        {
          fieldId: 'f1',
          fieldLabel: 'L1',
          suggestedValue: 'V1',
          confidence: 0.95,
          source: 'context',
        },
        {
          fieldId: 'f2',
          fieldLabel: 'L2',
          suggestedValue: 'V2',
          confidence: 0.9,
          source: 'ai',
        },
      ]);
      const suggestions = parseAutofillResponse(raw);
      const updated = acceptSuggestion(suggestions, 'f1');
      expect(updated[0].accepted).toBe(true);
      expect(updated[1].accepted).toBe(false);
    });

    it('rejects (removes) a suggestion by fieldId', () => {
      const raw = JSON.stringify([
        {
          fieldId: 'f1',
          fieldLabel: 'L1',
          suggestedValue: 'V1',
          confidence: 0.95,
          source: 'context',
        },
        {
          fieldId: 'f2',
          fieldLabel: 'L2',
          suggestedValue: 'V2',
          confidence: 0.9,
          source: 'ai',
        },
      ]);
      const suggestions = parseAutofillResponse(raw);
      const updated = rejectSuggestion(suggestions, 'f1');
      expect(updated).toHaveLength(1);
      expect(updated[0].fieldId).toBe('f2');
    });
  });

  /* ═══════ Natural Language Editing ═══════ */
  describe('buildNlEditPrompt', () => {
    it('includes document info in prompt', () => {
      const { systemPrompt, userPrompt } = buildNlEditPrompt(
        'Highlight all headings in red',
        { totalPages: 10, currentPage: 3, hasAnnotations: true },
      );
      expect(systemPrompt).toContain('10 pages');
      expect(systemPrompt).toContain('page 3');
      expect(systemPrompt).toContain('has existing annotations');
      expect(userPrompt).toBe('Highlight all headings in red');
    });
  });

  describe('NL command lifecycle', () => {
    it('creates → executes → completes', () => {
      const cmd = createNlCommand('Remove watermark on page 5');
      expect(cmd.status).toBe('pending');
      expect(cmd.input).toBe('Remove watermark on page 5');
      expect(cmd.interpretedAction).toBe('');

      const executing = markCommandExecuting(
        cmd,
        'Removing watermark from page 5',
      );
      expect(executing.status).toBe('executing');
      expect(executing.interpretedAction).toBe(
        'Removing watermark from page 5',
      );

      const completed = markCommandCompleted(
        executing,
        'Watermark removed successfully',
      );
      expect(completed.status).toBe('completed');
      expect(completed.result).toBe('Watermark removed successfully');
    });

    it('creates → fails', () => {
      const cmd = createNlCommand('Do something impossible');
      const failed = markCommandFailed(cmd, 'Unable to process');
      expect(failed.status).toBe('failed');
      expect(failed.result).toBe('Unable to process');
    });

    it('assigns sequential IDs', () => {
      const cmd1 = createNlCommand('first');
      const cmd2 = createNlCommand('second');
      expect(cmd1.id).not.toBe(cmd2.id);
    });
  });

  /* ═══════ Bookmarks ═══════ */
  describe('buildBookmarkGenerationPrompt', () => {
    it('includes page texts in prompt', () => {
      const { systemPrompt, userPrompt } = buildBookmarkGenerationPrompt([
        'Chapter 1: Introduction',
        'Chapter 2: Methods',
      ]);
      expect(systemPrompt).toContain('bookmark');
      expect(userPrompt).toContain('Page 1');
      expect(userPrompt).toContain('Chapter 1');
      expect(userPrompt).toContain('Page 2');
    });
  });

  describe('parseBookmarkResponse', () => {
    it('parses valid bookmarks', () => {
      const raw = JSON.stringify([
        { title: 'Introduction', page: 1, level: 1, confidence: 0.95 },
        { title: 'Methods', page: 3, level: 1, confidence: 0.9 },
        { title: 'Results Sub', page: 5, level: 2, confidence: 0.85 },
      ]);
      const result = parseBookmarkResponse(raw);
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Introduction');
      expect(result[0].level).toBe(1);
    });

    it('filters below-threshold bookmarks', () => {
      const raw = JSON.stringify([
        { title: 'Maybe', page: 1, level: 1, confidence: 0.1 },
      ]);
      expect(parseBookmarkResponse(raw)).toHaveLength(0);
    });

    it('clamps level between 1 and 6', () => {
      const raw = JSON.stringify([
        { title: 'Deep', page: 1, level: 10, confidence: 0.95 },
        { title: 'Negative', page: 2, level: -1, confidence: 0.95 },
      ]);
      const result = parseBookmarkResponse(raw);
      expect(result[0].level).toBe(6);
      expect(result[1].level).toBe(1);
    });

    it('truncates overly long titles', () => {
      const raw = JSON.stringify([
        { title: 'A'.repeat(250), page: 1, level: 1, confidence: 0.95 },
      ]);
      const result = parseBookmarkResponse(raw);
      expect(result[0].title.length).toBeLessThanOrEqual(200);
    });
  });

  describe('sortBookmarks', () => {
    it('sorts by page then level', () => {
      const bookmarks: GeneratedBookmark[] = [
        { title: 'B', page: 2, level: 1, confidence: 0.9 },
        { title: 'A2', page: 1, level: 2, confidence: 0.9 },
        { title: 'A1', page: 1, level: 1, confidence: 0.9 },
      ];
      const sorted = sortBookmarks(bookmarks);
      expect(sorted[0].title).toBe('A1');
      expect(sorted[1].title).toBe('A2');
      expect(sorted[2].title).toBe('B');
    });
  });

  /* ═══════ Smart Crop ═══════ */
  describe('buildSmartCropPrompt', () => {
    it('includes page dimensions', () => {
      const { systemPrompt } = buildSmartCropPrompt(1, {
        width: 612,
        height: 792,
      });
      expect(systemPrompt).toContain('612');
      expect(systemPrompt).toContain('792');
    });
  });

  describe('parseSmartCropResponse', () => {
    it('parses a valid crop result with padding', () => {
      const raw = JSON.stringify({
        x: 72,
        y: 72,
        width: 468,
        height: 648,
        confidence: 0.95,
      });
      const result = parseSmartCropResponse(raw, 1, {
        width: 612,
        height: 792,
      });
      expect(result).not.toBeNull();
      expect(result!.page).toBe(1);
      expect(result!.original).toEqual({ width: 612, height: 792 });
      // Padding applied: x - padding, y - padding, width + 2*padding, height + 2*padding (clamped)
      expect(result!.cropped.x).toBe(Math.max(0, 72 - AI_SMART_CROP_PADDING));
      expect(result!.cropped.y).toBe(Math.max(0, 72 - AI_SMART_CROP_PADDING));
    });

    it('returns null for unparseable input', () => {
      expect(
        parseSmartCropResponse('garbage', 1, { width: 612, height: 792 }),
      ).toBeNull();
    });
  });

  describe('calculateTrimSavings', () => {
    it('calculates savings percentage', () => {
      const result: SmartCropResult = {
        page: 1,
        original: { width: 100, height: 100 },
        cropped: { x: 10, y: 10, width: 50, height: 50 },
        confidence: 0.95,
      };
      const savings = calculateTrimSavings(result);
      expect(savings).toBe(75); // 50*50 / 100*100 = 0.25, so 75% savings
    });

    it('returns 0 for zero-area original', () => {
      const result: SmartCropResult = {
        page: 1,
        original: { width: 0, height: 0 },
        cropped: { x: 0, y: 0, width: 0, height: 0 },
        confidence: 0.95,
      };
      expect(calculateTrimSavings(result)).toBe(0);
    });
  });
});
