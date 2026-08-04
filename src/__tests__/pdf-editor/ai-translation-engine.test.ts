// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for ai-translation-engine.ts — Phase 5, Week 18
 *
 * Covers translation overlay management, language helpers,
 * prompt builders, response parsers, entity helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTranslationOverlay,
  addTranslationBlock,
  removeTranslationBlock,
  toggleOverlayVisibility,
  getBlocksForPage,
  resetBlockIdCounter,
  isLanguageSupported,
  getLanguageLabel,
  getSupportedLanguageCodes,
  buildTranslationPrompt,
  buildEnhancedOcrPrompt,
  buildNerPrompt,
  parseTranslationResponse,
  parseEnhancedOcrResponse,
  parseNerResponse,
  getEntityColor,
  getEntityLabel,
  mergeOverlappingEntities,
} from '@/app/dashboard/tools/pdf-editor/engine/ai-translation-engine';
import type { NamedEntity } from '@/app/dashboard/tools/pdf-editor/types';

beforeEach(() => {
  resetBlockIdCounter();
});

/* ──────────────── Translation Overlay ──────────────── */

describe('Translation overlay management', () => {
  it('creates an empty overlay', () => {
    const overlay = createTranslationOverlay('en', 'es');
    expect(overlay.blocks).toEqual([]);
    expect(overlay.sourceLanguage).toBe('en');
    expect(overlay.targetLanguage).toBe('es');
    expect(overlay.visible).toBe(true);
  });

  it('adds a translation block', () => {
    let overlay = createTranslationOverlay('en', 'es');
    overlay = addTranslationBlock(overlay, {
      page: 1,
      originalText: 'Hello',
      translatedText: 'Hola',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      sourceLanguage: 'en',
      targetLanguage: 'es',
    });
    expect(overlay.blocks).toHaveLength(1);
    expect(overlay.blocks[0].id).toBe('tr-block-1');
    expect(overlay.blocks[0].translatedText).toBe('Hola');
  });

  it('removes a translation block by ID', () => {
    let overlay = createTranslationOverlay('en', 'es');
    overlay = addTranslationBlock(overlay, {
      page: 1,
      originalText: 'A',
      translatedText: 'B',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      sourceLanguage: 'en',
      targetLanguage: 'es',
    });
    overlay = addTranslationBlock(overlay, {
      page: 1,
      originalText: 'C',
      translatedText: 'D',
      x: 0,
      y: 30,
      width: 100,
      height: 20,
      sourceLanguage: 'en',
      targetLanguage: 'es',
    });
    expect(overlay.blocks).toHaveLength(2);

    overlay = removeTranslationBlock(overlay, 'tr-block-1');
    expect(overlay.blocks).toHaveLength(1);
    expect(overlay.blocks[0].id).toBe('tr-block-2');
  });

  it('toggles visibility', () => {
    const overlay = createTranslationOverlay('en', 'fr');
    expect(overlay.visible).toBe(true);
    const toggled = toggleOverlayVisibility(overlay);
    expect(toggled.visible).toBe(false);
    const toggled2 = toggleOverlayVisibility(toggled);
    expect(toggled2.visible).toBe(true);
  });

  it('filters blocks by page', () => {
    let overlay = createTranslationOverlay('en', 'de');
    overlay = addTranslationBlock(overlay, {
      page: 1,
      originalText: 'A',
      translatedText: 'B',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      sourceLanguage: 'en',
      targetLanguage: 'de',
    });
    overlay = addTranslationBlock(overlay, {
      page: 2,
      originalText: 'C',
      translatedText: 'D',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      sourceLanguage: 'en',
      targetLanguage: 'de',
    });

    expect(getBlocksForPage(overlay, 1)).toHaveLength(1);
    expect(getBlocksForPage(overlay, 2)).toHaveLength(1);
    expect(getBlocksForPage(overlay, 3)).toHaveLength(0);
  });
});

/* ──────────────── Language Helpers ──────────────── */

describe('Language helpers', () => {
  it('checks language support', () => {
    expect(isLanguageSupported('en')).toBe(true);
    expect(isLanguageSupported('ES')).toBe(true);
    expect(isLanguageSupported('klingon')).toBe(false);
  });

  it('gets language label', () => {
    expect(getLanguageLabel('en')).toBe('English');
    expect(getLanguageLabel('es')).toBe('Spanish');
    expect(getLanguageLabel('xx')).toBe('xx');
  });

  it('gets all supported codes', () => {
    const codes = getSupportedLanguageCodes();
    expect(codes).toContain('en');
    expect(codes).toContain('zh');
    expect(codes.length).toBe(12);
  });
});

/* ──────────────── Prompt Builders ──────────────── */

describe('buildTranslationPrompt', () => {
  it('includes source and target languages', () => {
    const result = buildTranslationPrompt(['Hello world'], 'en', 'es');
    expect(result.systemPrompt).toContain('English');
    expect(result.systemPrompt).toContain('Spanish');
    expect(result.userPrompt).toContain('Hello world');
  });
});

describe('buildEnhancedOcrPrompt', () => {
  it('includes page number', () => {
    const result = buildEnhancedOcrPrompt('OCR text', 5);
    expect(result.userPrompt).toContain('Page 5');
    expect(result.systemPrompt).toContain('OCR');
  });
});

describe('buildNerPrompt', () => {
  it('includes entity types', () => {
    const result = buildNerPrompt('John works at Google', 1);
    expect(result.systemPrompt).toContain('person');
    expect(result.systemPrompt).toContain('organization');
  });
});

/* ──────────────── Response Parsers ──────────────── */

describe('parseTranslationResponse', () => {
  it('parses translation blocks', () => {
    const raw = JSON.stringify([
      {
        page: 1,
        originalText: 'Hello',
        translatedText: 'Hola',
        x: 10,
        y: 20,
        width: 100,
        height: 15,
      },
      {
        page: 1,
        originalText: 'World',
        translatedText: 'Mundo',
        x: 10,
        y: 40,
        width: 100,
        height: 15,
      },
    ]);
    const blocks = parseTranslationResponse(raw, 'en', 'es');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].sourceLanguage).toBe('en');
    expect(blocks[0].targetLanguage).toBe('es');
    expect(blocks[0].translatedText).toBe('Hola');
  });

  it('returns empty for empty response', () => {
    expect(parseTranslationResponse('[]', 'en', 'es')).toEqual([]);
  });
});

describe('parseEnhancedOcrResponse', () => {
  it('parses OCR result with blocks', () => {
    const raw = JSON.stringify({
      text: 'Full text',
      confidence: 0.92,
      language: 'en',
      blocks: [
        {
          text: 'Heading',
          type: 'heading',
          confidence: 0.95,
          x: 0,
          y: 0,
          width: 100,
          height: 20,
        },
        {
          text: 'Paragraph',
          type: 'paragraph',
          confidence: 0.9,
          x: 0,
          y: 30,
          width: 100,
          height: 40,
        },
      ],
    });
    const result = parseEnhancedOcrResponse(raw);
    expect(result.text).toBe('Full text');
    expect(result.confidence).toBe(0.92);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].type).toBe('heading');
    expect(result.blocks[1].type).toBe('paragraph');
  });

  it('defaults unknown block type to paragraph', () => {
    const raw = JSON.stringify({
      text: 'X',
      confidence: 0.5,
      language: 'en',
      blocks: [
        {
          text: 'X',
          type: 'unknown-type',
          confidence: 0.5,
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
    });
    const result = parseEnhancedOcrResponse(raw);
    expect(result.blocks[0].type).toBe('paragraph');
  });
});

describe('parseNerResponse', () => {
  it('parses named entities', () => {
    const raw = JSON.stringify([
      { text: 'John Doe', type: 'person', startIndex: 0, endIndex: 8 },
      { text: 'Google', type: 'organization', startIndex: 20, endIndex: 26 },
    ]);
    const entities = parseNerResponse(raw, 1);
    expect(entities).toHaveLength(2);
    expect(entities[0].type).toBe('person');
    expect(entities[0].page).toBe(1);
    expect(entities[1].type).toBe('organization');
  });

  it('filters out invalid entity types', () => {
    const raw = JSON.stringify([
      { text: 'X', type: 'alien', startIndex: 0, endIndex: 1 },
      { text: 'Y', type: 'person', startIndex: 5, endIndex: 6 },
    ]);
    const entities = parseNerResponse(raw, 1);
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe('person');
  });
});

/* ──────────────── Entity Helpers ──────────────── */

describe('Entity helpers', () => {
  it('gets entity color', () => {
    expect(getEntityColor('person')).toBe('#3B82F6');
    expect(getEntityColor('unknown')).toBe('#6B7280');
  });

  it('gets entity label', () => {
    expect(getEntityLabel('organization')).toBe('Organization');
    expect(getEntityLabel('bogus')).toBe('bogus');
  });
});

describe('mergeOverlappingEntities', () => {
  it('merges overlapping entities on same page', () => {
    const entities: NamedEntity[] = [
      { text: 'John', type: 'person', page: 1, startIndex: 0, endIndex: 4 },
      { text: 'John Doe', type: 'person', page: 1, startIndex: 0, endIndex: 8 },
    ];
    const merged = mergeOverlappingEntities(entities);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('John Doe');
  });

  it('keeps non-overlapping entities', () => {
    const entities: NamedEntity[] = [
      { text: 'John', type: 'person', page: 1, startIndex: 0, endIndex: 4 },
      {
        text: 'Google',
        type: 'organization',
        page: 1,
        startIndex: 20,
        endIndex: 26,
      },
    ];
    const merged = mergeOverlappingEntities(entities);
    expect(merged).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(mergeOverlappingEntities([])).toEqual([]);
  });

  it('handles single entity', () => {
    const entities: NamedEntity[] = [
      { text: 'John', type: 'person', page: 1, startIndex: 0, endIndex: 4 },
    ];
    expect(mergeOverlappingEntities(entities)).toEqual(entities);
  });
});
