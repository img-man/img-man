// SPDX-License-Identifier: Apache-2.0
/**
 * AI Translation Engine — Phase 5, Week 18
 *
 * Provides:
 * - Translation overlay management (per-page block positioning)
 * - Enhanced OCR result normalization
 * - Named Entity Recognition (NER) extraction and merging
 * - Language detection helpers
 * - Prompt builders for Gemini-powered translation & OCR
 */

import type {
  TranslationBlock,
  TranslationOverlay,
  EnhancedOcrResult,
  OcrBlock,
  NamedEntity,
} from '../types';
import {
  AI_MODEL_NAME,
  AI_MAX_PAGES_PER_REQUEST,
  SUPPORTED_LANGUAGES,
  ENTITY_TYPES,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   Translation overlay helpers
   ══════════════════════════════════════════════════════════════════════════ */

let nextBlockId = 1;

/** Create a fresh, empty translation overlay. */
export function createTranslationOverlay(
  sourceLanguage: string,
  targetLanguage: string,
): TranslationOverlay {
  return {
    blocks: [],
    sourceLanguage,
    targetLanguage,
    visible: true,
    generatedAt: new Date(),
  };
}

/** Add a translated block to the overlay, returning a new overlay. */
export function addTranslationBlock(
  overlay: TranslationOverlay,
  block: Omit<TranslationBlock, 'id'>,
): TranslationOverlay {
  const id = `tr-block-${nextBlockId++}`;
  return {
    ...overlay,
    blocks: [...overlay.blocks, { ...block, id }],
    generatedAt: new Date(),
  };
}

/** Remove a translation block by ID. */
export function removeTranslationBlock(
  overlay: TranslationOverlay,
  blockId: string,
): TranslationOverlay {
  return {
    ...overlay,
    blocks: overlay.blocks.filter((b) => b.id !== blockId),
  };
}

/** Toggle translation overlay visibility. */
export function toggleOverlayVisibility(
  overlay: TranslationOverlay,
): TranslationOverlay {
  return { ...overlay, visible: !overlay.visible };
}

/** Filter overlay blocks by page. */
export function getBlocksForPage(
  overlay: TranslationOverlay,
  page: number,
): TranslationBlock[] {
  return overlay.blocks.filter((b) => b.page === page);
}

/** Reset block ID counter (for testing). */
export function resetBlockIdCounter(): void {
  nextBlockId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Language helpers
   ══════════════════════════════════════════════════════════════════════════ */

/** Check if a language code is supported. */
export function isLanguageSupported(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code.toLowerCase());
}

/** Get a language label from its code. Returns the code itself if not found. */
export function getLanguageLabel(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase());
  return lang?.label ?? code;
}

/** Get all supported language codes. */
export function getSupportedLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((l) => l.code);
}

/* ══════════════════════════════════════════════════════════════════════════
   Prompt builders
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a prompt for translating OCR text from one language to another.
 * The AI should return an array of translation blocks with positional data.
 */
export function buildTranslationPrompt(
  pageTexts: string[],
  sourceLanguage: string,
  targetLanguage: string,
): { model: string; systemPrompt: string; userPrompt: string } {
  const clampedTexts = pageTexts.slice(0, AI_MAX_PAGES_PER_REQUEST);

  const systemPrompt = [
    `You are a professional document translator. Translate from ${getLanguageLabel(sourceLanguage)} to ${getLanguageLabel(targetLanguage)}.`,
    'Preserve document structure and formatting. Translate all text content.',
    'Return JSON array: [{ "page": number, "originalText": string, "translatedText": string, "x": number, "y": number, "width": number, "height": number }]',
    'Use x=0, y=0, width=100, height=100 as default positioning if unknown.',
  ].join('\n');

  const userPrompt = clampedTexts
    .map((text, i) => `--- PAGE ${i + 1} ---\n${text}`)
    .join('\n\n');

  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Build a prompt for enhanced OCR with block-level segmentation.
 */
export function buildEnhancedOcrPrompt(
  pageText: string,
  pageNumber: number,
): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'You are an advanced OCR analysis AI. Analyze the page text and segment it into semantic blocks.',
    'Identify block types: paragraph, heading, list-item, table-cell, header, footer.',
    'Also detect the language and estimate confidence.',
    'Return JSON: { "text": string, "confidence": number (0-1), "language": string, "blocks": [{ "text": string, "x": 0, "y": 0, "width": 100, "height": 100, "confidence": number, "type": string }], "tables": [] }',
  ].join('\n');

  const userPrompt = `Page ${pageNumber}:\n${pageText}`;
  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Build a prompt for Named Entity Recognition (NER).
 */
export function buildNerPrompt(
  pageText: string,
  pageNumber: number,
): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const validTypes = ENTITY_TYPES.map((e) => e.value).join(', ');

  const systemPrompt = [
    'You are a Named Entity Recognition (NER) AI. Identify all named entities in the text.',
    `Valid entity types: ${validTypes}.`,
    'Return JSON array: [{ "text": string, "type": string, "startIndex": number, "endIndex": number, "normalizedValue": string | null }]',
    'normalizedValue should be the standardized form (e.g., dates as ISO 8601, phone as E.164).',
  ].join('\n');

  const userPrompt = `Page ${pageNumber}:\n${pageText}`;
  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/* ══════════════════════════════════════════════════════════════════════════
   Response parsers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse AI response into TranslationBlock[].
 */
export function parseTranslationResponse(
  raw: string,
  sourceLanguage: string,
  targetLanguage: string,
): TranslationBlock[] {
  const json = extractJson(raw);
  const items: unknown[] = Array.isArray(json) ? json : [];

  return items.map((item: unknown, idx: number) => {
    const b = item as Record<string, unknown>;
    return {
      id: `tr-block-${nextBlockId++}`,
      page: Number(b.page ?? 1),
      originalText: String(b.originalText ?? ''),
      translatedText: String(b.translatedText ?? ''),
      x: Number(b.x ?? 0),
      y: Number(b.y ?? 0),
      width: Number(b.width ?? 100),
      height: Number(b.height ?? 100),
      sourceLanguage,
      targetLanguage,
    };
  });
}

/**
 * Parse AI response into an EnhancedOcrResult.
 */
export function parseEnhancedOcrResponse(raw: string): EnhancedOcrResult {
  const json = extractJsonObj(raw);

  const blocks: OcrBlock[] = Array.isArray(json.blocks)
    ? json.blocks.map((b: Record<string, unknown>) => ({
        text: String(b.text ?? ''),
        x: Number(b.x ?? 0),
        y: Number(b.y ?? 0),
        width: Number(b.width ?? 100),
        height: Number(b.height ?? 100),
        confidence: clamp01(Number(b.confidence ?? 0)),
        type: validateBlockType(b.type),
      }))
    : [];

  return {
    text: String(json.text ?? ''),
    confidence: clamp01(Number(json.confidence ?? 0)),
    language: String(json.language ?? 'en'),
    blocks,
    tables: [], // Tables handled by ai-document-engine
  };
}

/**
 * Parse AI response into NamedEntity[].
 */
export function parseNerResponse(
  raw: string,
  pageNumber: number,
): NamedEntity[] {
  const json = extractJson(raw);
  const items: unknown[] = Array.isArray(json) ? json : [];

  return items
    .map((item: unknown) => {
      const e = item as Record<string, unknown>;
      const type = validateEntityType(e.type);
      if (!type) return null;

      return {
        text: String(e.text ?? ''),
        type,
        page: pageNumber,
        startIndex: Number(e.startIndex ?? 0),
        endIndex: Number(e.endIndex ?? 0),
        normalizedValue: e.normalizedValue
          ? String(e.normalizedValue)
          : undefined,
      } as NamedEntity;
    })
    .filter((e): e is NamedEntity => e !== null);
}

/* ══════════════════════════════════════════════════════════════════════════
   Entity helpers
   ══════════════════════════════════════════════════════════════════════════ */

/** Get the display color for an entity type. */
export function getEntityColor(type: string): string {
  const entity = ENTITY_TYPES.find((e) => e.value === type);
  return entity?.color ?? '#6B7280';
}

/** Get the label for an entity type. */
export function getEntityLabel(type: string): string {
  const entity = ENTITY_TYPES.find((e) => e.value === type);
  return entity?.label ?? type;
}

/** Merge overlapping entities, keeping the highest confidence. */
export function mergeOverlappingEntities(
  entities: NamedEntity[],
): NamedEntity[] {
  if (entities.length <= 1) return entities;

  const sorted = [...entities].sort((a, b) => a.startIndex - b.startIndex);
  const merged: NamedEntity[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.page === prev.page && curr.startIndex <= prev.endIndex) {
      // Overlapping — keep the longer one
      if (curr.endIndex - curr.startIndex > prev.endIndex - prev.startIndex) {
        merged[merged.length - 1] = curr;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal utilities
   ══════════════════════════════════════════════════════════════════════════ */

function extractJson(raw: string): unknown[] | Record<string, unknown> {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const arrStart = cleaned.indexOf('[');
    const objStart = cleaned.indexOf('{');
    const start =
      arrStart >= 0 && (objStart < 0 || arrStart < objStart)
        ? arrStart
        : objStart;
    if (start >= 0) {
      try {
        return JSON.parse(cleaned.slice(start));
      } catch {
        // fall through
      }
    }
    return [];
  }
}

function extractJsonObj(raw: string): Record<string, unknown> {
  const result = extractJson(raw);
  return Array.isArray(result) ? {} : result;
}

const VALID_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'list-item',
  'table-cell',
  'header',
  'footer',
]);

function validateBlockType(value: unknown): OcrBlock['type'] {
  const s = String(value ?? 'paragraph').toLowerCase();
  return VALID_BLOCK_TYPES.has(s) ? (s as OcrBlock['type']) : 'paragraph';
}

const VALID_ENTITY_TYPES = new Set<string>(ENTITY_TYPES.map((e) => e.value));

function validateEntityType(value: unknown): NamedEntity['type'] | null {
  const s = String(value ?? '').toLowerCase();
  return VALID_ENTITY_TYPES.has(s) ? (s as NamedEntity['type']) : null;
}

function clamp01(n: number): number {
  return isNaN(n) ? 0 : Math.max(0, Math.min(1, n));
}
