// SPDX-License-Identifier: Apache-2.0
/**
 * AI Advanced Engine — Phase 6, Week 23
 *
 * Provides:
 * - PII detection prompt builders & response parsers
 * - Smart auto-fill suggestion management
 * - Natural language command parsing & execution planning
 * - Auto-bookmark generation from structure analysis
 * - Smart crop detection helpers
 *
 * Note: Actual AI inference calls are handled by the hook layer.
 * This engine provides prompt construction, response normalization,
 * and pure state management.
 */

import type {
  PiiDetection,
  PiiType,
  NlEditCommand,
  SmartAutofillSuggestion,
  GeneratedBookmark,
  SmartCropResult,
} from '../types';
import {
  PII_TYPES,
  AI_AUTOFILL_CONFIDENCE_THRESHOLD,
  AI_PII_CONFIDENCE_THRESHOLD,
  AI_BOOKMARK_CONFIDENCE_THRESHOLD,
  AI_SMART_CROP_PADDING,
  AI_MODEL_NAME,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   ID counters (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextPiiId = 1;
let nextCommandId = 1;

export function resetAiAdvancedIdCounters(): void {
  nextPiiId = 1;
  nextCommandId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   PII detection (Week 23 — Suggest Redactions)
   ══════════════════════════════════════════════════════════════════════════ */

/** Build the prompt for PII detection. */
export function buildPiiDetectionPrompt(
  textBlocks: string[],
  pageNumber: number,
): { systemPrompt: string; userPrompt: string } {
  const piiList = PII_TYPES.map(
    (p) => `- ${p.label} (${p.value}): ${p.pattern || 'custom pattern'}`,
  ).join('\n');

  return {
    systemPrompt: `You are a PII detection specialist using ${AI_MODEL_NAME}. Identify all personally identifiable information (PII) in the provided text. For each detection, return the exact text, its type, position (x, y, width, height in PDF points), and a confidence score (0–1). PII types:\n${piiList}\n\nReturn JSON array: [{ "text": "...", "type": "ssn|credit-card|email|phone|address|dob|passport|other", "x": 0, "y": 0, "width": 0, "height": 0, "confidence": 0.95 }]`,
    userPrompt: `Page ${pageNumber} text:\n${textBlocks.join('\n')}`,
  };
}

/** Parse the PII detection response. */
export function parsePiiDetectionResponse(
  raw: string,
  pageNumber: number,
): PiiDetection[] {
  const json = extractJsonArray(raw);
  if (!json) return [];

  const validTypes = new Set<string>(PII_TYPES.map((p) => p.value));

  return json
    .filter((item: Record<string, unknown>) => {
      const type = String(item.type ?? '');
      const confidence = Number(item.confidence ?? 0);
      return validTypes.has(type) && confidence >= AI_PII_CONFIDENCE_THRESHOLD;
    })
    .map(
      (item: Record<string, unknown>): PiiDetection => ({
        id: `pii-${nextPiiId++}`,
        type: item.type as PiiType,
        text: String(item.text ?? ''),
        page: pageNumber,
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
        confidence: clampConfidence(Number(item.confidence ?? 0)),
        accepted: false,
      }),
    );
}

/** Accept a PII detection (mark for redaction). */
export function acceptPiiDetection(
  detections: PiiDetection[],
  piiId: string,
): PiiDetection[] {
  return detections.map((d) => (d.id === piiId ? { ...d, accepted: true } : d));
}

/** Reject a PII detection (dismiss). */
export function rejectPiiDetection(
  detections: PiiDetection[],
  piiId: string,
): PiiDetection[] {
  return detections.filter((d) => d.id !== piiId);
}

/** Accept all PII detections. */
export function acceptAllPii(detections: PiiDetection[]): PiiDetection[] {
  return detections.map((d) => ({ ...d, accepted: true }));
}

/** Get PII detections grouped by type. */
export function groupPiiByType(
  detections: PiiDetection[],
): Record<string, PiiDetection[]> {
  const groups: Record<string, PiiDetection[]> = {};
  for (const d of detections) {
    if (!groups[d.type]) groups[d.type] = [];
    groups[d.type].push(d);
  }
  return groups;
}

/** Get display color for a PII type. */
export function getPiiTypeColor(type: PiiType): string {
  const pii = PII_TYPES.find((p) => p.value === type);
  return pii?.color ?? '#6B7280';
}

/** Get display label for a PII type. */
export function getPiiTypeLabel(type: PiiType): string {
  const pii = PII_TYPES.find((p) => p.value === type);
  return pii?.label ?? type;
}

/* ══════════════════════════════════════════════════════════════════════════
   Smart Auto-fill (Week 23)
   ══════════════════════════════════════════════════════════════════════════ */

/** Build prompt for smart auto-fill suggestions. */
export function buildAutofillPrompt(
  formFields: { id: string; label: string; type: string }[],
  documentContext: string,
): { systemPrompt: string; userPrompt: string } {
  const fieldList = formFields
    .map((f) => `- "${f.label}" (type: ${f.type}, id: ${f.id})`)
    .join('\n');

  return {
    systemPrompt: `You are a form auto-fill AI using ${AI_MODEL_NAME}. Based on the document context and form field labels, suggest appropriate values for each field. Return JSON array: [{ "fieldId": "...", "fieldLabel": "...", "suggestedValue": "...", "confidence": 0.9, "source": "context|profile|ai" }]\nOnly suggest values with confidence >= ${AI_AUTOFILL_CONFIDENCE_THRESHOLD}.`,
    userPrompt: `Form fields:\n${fieldList}\n\nDocument context:\n${documentContext}`,
  };
}

/** Parse auto-fill suggestions from AI response. */
export function parseAutofillResponse(raw: string): SmartAutofillSuggestion[] {
  const json = extractJsonArray(raw);
  if (!json) return [];

  return json
    .filter((item: Record<string, unknown>) => {
      const confidence = Number(item.confidence ?? 0);
      return confidence >= AI_AUTOFILL_CONFIDENCE_THRESHOLD;
    })
    .map(
      (item: Record<string, unknown>): SmartAutofillSuggestion => ({
        fieldId: String(item.fieldId ?? ''),
        fieldLabel: String(item.fieldLabel ?? ''),
        suggestedValue: String(item.suggestedValue ?? ''),
        confidence: clampConfidence(Number(item.confidence ?? 0)),
        source: validateSource(item.source),
        accepted: false,
      }),
    );
}

/** Accept an auto-fill suggestion. */
export function acceptSuggestion(
  suggestions: SmartAutofillSuggestion[],
  fieldId: string,
): SmartAutofillSuggestion[] {
  return suggestions.map((s) =>
    s.fieldId === fieldId ? { ...s, accepted: true } : s,
  );
}

/** Reject an auto-fill suggestion. */
export function rejectSuggestion(
  suggestions: SmartAutofillSuggestion[],
  fieldId: string,
): SmartAutofillSuggestion[] {
  return suggestions.filter((s) => s.fieldId !== fieldId);
}

/* ══════════════════════════════════════════════════════════════════════════
   Natural Language Editing (Week 23)
   ══════════════════════════════════════════════════════════════════════════ */

/** Build prompt for interpreting a natural language editing command. */
export function buildNlEditPrompt(
  userInput: string,
  documentInfo: {
    totalPages: number;
    currentPage: number;
    hasAnnotations: boolean;
  },
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are a PDF editing assistant using ${AI_MODEL_NAME}. The user will give natural language instructions about editing their PDF. Interpret their intent and respond with a structured action plan.\n\nDocument: ${documentInfo.totalPages} pages, currently on page ${documentInfo.currentPage}, ${documentInfo.hasAnnotations ? 'has existing annotations' : 'no annotations yet'}.\n\nReturn JSON: { "interpretedAction": "Brief description of what to do", "actionType": "annotate|page-ops|highlight|redact|format|navigate|other", "parameters": { ... } }`,
    userPrompt: userInput,
  };
}

/** Create a command record from user input. */
export function createNlCommand(input: string): NlEditCommand {
  return {
    id: `nl-cmd-${nextCommandId++}`,
    input,
    interpretedAction: '',
    status: 'pending',
    timestamp: new Date(),
  };
}

/** Mark a command as executing with interpreted action. */
export function markCommandExecuting(
  command: NlEditCommand,
  interpretedAction: string,
): NlEditCommand {
  return { ...command, interpretedAction, status: 'executing' };
}

/** Mark a command as completed. */
export function markCommandCompleted(
  command: NlEditCommand,
  result: string,
): NlEditCommand {
  return { ...command, status: 'completed', result };
}

/** Mark a command as failed. */
export function markCommandFailed(
  command: NlEditCommand,
  error: string,
): NlEditCommand {
  return { ...command, status: 'failed', result: error };
}

/* ══════════════════════════════════════════════════════════════════════════
   Auto-generate Bookmarks (Week 23)
   ══════════════════════════════════════════════════════════════════════════ */

/** Build prompt for auto-generating bookmarks from document text. */
export function buildBookmarkGenerationPrompt(pageTexts: string[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a document structure analyst using ${AI_MODEL_NAME}. Analyze the document text page by page and identify headings/sections to create bookmarks. Return a JSON array: [{ "title": "Section Title", "page": 1, "level": 1, "confidence": 0.9 }]\nLevels: 1 = top heading, 2 = sub-heading, 3 = subsection, etc. Only include bookmarks with confidence >= ${AI_BOOKMARK_CONFIDENCE_THRESHOLD}.`,
    userPrompt: pageTexts
      .map((text, i) => `--- Page ${i + 1} ---\n${text}`)
      .join('\n\n'),
  };
}

/** Parse auto-generated bookmarks from AI response. */
export function parseBookmarkResponse(raw: string): GeneratedBookmark[] {
  const json = extractJsonArray(raw);
  if (!json) return [];

  return json
    .filter((item: Record<string, unknown>) => {
      const confidence = Number(item.confidence ?? 0);
      return (
        confidence >= AI_BOOKMARK_CONFIDENCE_THRESHOLD &&
        item.title &&
        item.page
      );
    })
    .map(
      (item: Record<string, unknown>): GeneratedBookmark => ({
        title: String(item.title ?? '').slice(0, 200),
        page: Math.max(1, Math.floor(Number(item.page ?? 1))),
        level: Math.max(1, Math.min(6, Math.floor(Number(item.level ?? 1)))),
        confidence: clampConfidence(Number(item.confidence ?? 0)),
      }),
    );
}

/** Sort bookmarks by page + level order. */
export function sortBookmarks(
  bookmarks: GeneratedBookmark[],
): GeneratedBookmark[] {
  return [...bookmarks].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.level - b.level;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Smart Crop (Week 23)
   ══════════════════════════════════════════════════════════════════════════ */

/** Build prompt for detecting content boundaries. */
export function buildSmartCropPrompt(
  pageNumber: number,
  pageDimensions: { width: number; height: number },
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are a page layout analyst using ${AI_MODEL_NAME}. Analyze the page image and detect the actual content boundaries (exclude margins, headers, footers, page numbers). Return JSON: { "x": 72, "y": 72, "width": 468, "height": 648, "confidence": 0.95 }\nCoordinates are in PDF points from top-left. Page size: ${pageDimensions.width}×${pageDimensions.height} points.`,
    userPrompt: `Analyze page ${pageNumber} for content boundaries.`,
  };
}

/** Parse smart crop result. */
export function parseSmartCropResponse(
  raw: string,
  pageNumber: number,
  pageDimensions: { width: number; height: number },
): SmartCropResult | null {
  const json = extractJsonObject(raw);
  if (!json) return null;

  const x = Math.max(0, Number(json.x ?? 0) - AI_SMART_CROP_PADDING);
  const y = Math.max(0, Number(json.y ?? 0) - AI_SMART_CROP_PADDING);
  const rawWidth = Number(json.width ?? pageDimensions.width);
  const rawHeight = Number(json.height ?? pageDimensions.height);
  const width = Math.min(
    rawWidth + AI_SMART_CROP_PADDING * 2,
    pageDimensions.width - x,
  );
  const height = Math.min(
    rawHeight + AI_SMART_CROP_PADDING * 2,
    pageDimensions.height - y,
  );

  return {
    page: pageNumber,
    original: pageDimensions,
    cropped: { x, y, width, height },
    confidence: clampConfidence(Number(json.confidence ?? 0)),
  };
}

/** Calculate trim savings as a percentage. */
export function calculateTrimSavings(result: SmartCropResult): number {
  const originalArea = result.original.width * result.original.height;
  const croppedArea = result.cropped.width * result.cropped.height;
  if (originalArea === 0) return 0;
  return Math.round((1 - croppedArea / originalArea) * 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal utilities
   ══════════════════════════════════════════════════════════════════════════ */

function extractJsonArray(raw: string): Record<string, unknown>[] | null {
  try {
    const cleaned = raw
      .replace(/```json?\s*/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Try to find array in the text
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw
      .replace(/```json?\s*/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function validateSource(value: unknown): 'context' | 'profile' | 'ai' {
  const str = String(value ?? 'ai').toLowerCase();
  if (str === 'context' || str === 'profile') return str;
  return 'ai';
}
