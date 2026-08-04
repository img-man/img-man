// SPDX-License-Identifier: Apache-2.0
/**
 * AI Document Engine — Phase 5, Week 17
 *
 * Provides AI-powered document understanding:
 * - Document summarization (full + per-page)
 * - Table extraction with header detection
 * - Key-value pair extraction (invoices, receipts, forms)
 * - Document classification
 * - Content Q&A (ask questions about the document)
 *
 * Uses prompt-building helpers that produce structured payloads
 * for Vertex AI / Gemini consumption.
 */

import type {
  DocumentType,
  DocumentSummary,
  ExtractedTable,
  KeyValuePair,
  DocumentClassification,
  ContentAnswer,
  AiTaskStatus,
  AiTaskResult,
} from '../types';
import {
  AI_MODEL_NAME,
  AI_MAX_PAGES_PER_REQUEST,
  AI_SUMMARY_MAX_LENGTH,
  AI_ANSWER_MAX_LENGTH,
  DOCUMENT_TYPES,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   Task-result factory
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a fresh idle task result. */
export function createIdleTask<T>(): AiTaskResult<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
    startedAt: null,
    completedAt: null,
  };
}

/** Mark a task as processing. */
export function markProcessing<T>(prev: AiTaskResult<T>): AiTaskResult<T> {
  return {
    ...prev,
    status: 'processing',
    error: null,
    startedAt: new Date(),
    completedAt: null,
  };
}

/** Mark a task as completed with data. */
export function markCompleted<T>(
  prev: AiTaskResult<T>,
  data: T,
): AiTaskResult<T> {
  return {
    ...prev,
    status: 'completed',
    data,
    error: null,
    completedAt: new Date(),
  };
}

/** Mark a task as failed with an error message. */
export function markFailed<T>(
  prev: AiTaskResult<T>,
  error: string,
): AiTaskResult<T> {
  return {
    ...prev,
    status: 'failed',
    data: null,
    error,
    completedAt: new Date(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Prompt builders
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Builds the system + user prompt for document summarization.
 * The AI should return: fullSummary, keyFindings[], documentType, confidence.
 */
export function buildSummarizationPrompt(pageTexts: string[]): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const clampedTexts = pageTexts.slice(0, AI_MAX_PAGES_PER_REQUEST);

  const systemPrompt = [
    'You are a document analysis AI. Analyze the provided document text and produce a structured JSON response.',
    `Maximum summary length: ${AI_SUMMARY_MAX_LENGTH} characters.`,
    'Response schema: { "fullSummary": string, "keyFindings": string[], "pageSummaries": { [pageNumber]: string }, "documentType": string, "confidence": number (0-1) }',
    `Valid document types: ${DOCUMENT_TYPES.map((d) => d.value).join(', ')}.`,
  ].join('\n');

  const userPrompt = clampedTexts
    .map((text, i) => `--- PAGE ${i + 1} ---\n${text}`)
    .join('\n\n');

  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Builds a prompt for table extraction from page text.
 * Expected AI response: array of { headers: string[], rows: string[][], x, y, width, height, confidence }.
 */
export function buildTableExtractionPrompt(
  pageText: string,
  pageNumber: number,
): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'You are a table extraction AI. Find all tables in the provided page text.',
    'Return a JSON array of tables. Each table: { "headers": string[], "rows": string[][], "x": 0, "y": 0, "width": 100, "height": 100, "confidence": number (0-1) }',
    'If no tables are found, return an empty array [].',
  ].join('\n');

  const userPrompt = `Page ${pageNumber}:\n${pageText}`;
  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Builds a prompt for key-value pair extraction (e.g. invoice fields).
 */
export function buildKeyValueExtractionPrompt(
  pageText: string,
  pageNumber: number,
): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'You are a document data extraction AI. Extract all key-value pairs from the text.',
    'Common pairs: Invoice Number, Date, Total, Tax, Vendor, Address, etc.',
    'Return JSON array: [{ "key": string, "value": string, "confidence": number (0-1) }]',
    'If no pairs found, return [].',
  ].join('\n');

  const userPrompt = `Page ${pageNumber}:\n${pageText}`;
  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Builds a prompt for document classification.
 */
export function buildClassificationPrompt(sampleText: string): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const typeList = DOCUMENT_TYPES.map((d) => d.value).join(', ');

  const systemPrompt = [
    'You are a document classifier AI. Classify the document into one of these types:',
    typeList,
    'Return JSON: { "type": string, "confidence": number (0-1), "alternativeTypes": [{ "type": string, "confidence": number }] }',
  ].join('\n');

  const userPrompt = sampleText.slice(0, 3000); // Only first ~3k chars needed
  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/**
 * Builds a prompt for content Q&A.
 */
export function buildContentQAPrompt(
  question: string,
  pageTexts: string[],
): {
  model: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const clampedTexts = pageTexts.slice(0, AI_MAX_PAGES_PER_REQUEST);

  const systemPrompt = [
    'You are a document Q&A AI. Answer the user question based ONLY on the provided document text.',
    `Maximum answer length: ${AI_ANSWER_MAX_LENGTH} characters.`,
    'Return JSON: { "answer": string, "confidence": number (0-1), "sourcePage": number, "sourceSnippet": string }',
    'If the answer cannot be found, set confidence to 0 and answer to "Information not found in document."',
  ].join('\n');

  const context = clampedTexts
    .map((t, i) => `--- PAGE ${i + 1} ---\n${t}`)
    .join('\n\n');
  const userPrompt = `Question: ${question}\n\nDocument:\n${context}`;

  return { model: AI_MODEL_NAME, systemPrompt, userPrompt };
}

/* ══════════════════════════════════════════════════════════════════════════
   Response parsers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a raw JSON string from the AI into a DocumentSummary.
 * Validates required fields, provides fallbacks for missing data.
 */
export function parseSummaryResponse(raw: string): DocumentSummary {
  const json = extractJson(raw);

  const pageSummaries = new Map<number, string>();
  if (json.pageSummaries && typeof json.pageSummaries === 'object') {
    for (const [k, v] of Object.entries(json.pageSummaries)) {
      const num = parseInt(k, 10);
      if (!isNaN(num) && typeof v === 'string') {
        pageSummaries.set(num, v);
      }
    }
  }

  return {
    fullSummary: truncate(
      String(json.fullSummary ?? ''),
      AI_SUMMARY_MAX_LENGTH,
    ),
    keyFindings: Array.isArray(json.keyFindings)
      ? json.keyFindings.map(String)
      : [],
    pageSummaries,
    documentType: validateDocumentType(json.documentType),
    confidence: clampConfidence(json.confidence),
    generatedAt: new Date(),
  };
}

/**
 * Parse a raw JSON string into ExtractedTable[].
 */
export function parseTableResponse(
  raw: string,
  pageNumber: number,
): ExtractedTable[] {
  const json = extractJson(raw);
  const rawTables = Array.isArray(json)
    ? json
    : (json as Record<string, unknown>).tables;
  const tables: unknown[] = Array.isArray(rawTables) ? rawTables : [];

  return tables.map((t: unknown, idx: number) => {
    const table = t as Record<string, unknown>;
    return {
      id: `table-${pageNumber}-${idx}`,
      page: pageNumber,
      x: Number(table.x ?? 0),
      y: Number(table.y ?? 0),
      width: Number(table.width ?? 100),
      height: Number(table.height ?? 100),
      headers: Array.isArray(table.headers) ? table.headers.map(String) : [],
      rows: Array.isArray(table.rows)
        ? (table.rows as unknown[][]).map((r) =>
            Array.isArray(r) ? r.map(String) : [],
          )
        : [],
      confidence: clampConfidence(table.confidence),
    };
  });
}

/**
 * Parse a raw JSON string into KeyValuePair[].
 */
export function parseKeyValueResponse(
  raw: string,
  pageNumber: number,
): KeyValuePair[] {
  const json = extractJson(raw);
  const rawPairs = Array.isArray(json)
    ? json
    : (json as Record<string, unknown>).pairs;
  const pairs: unknown[] = Array.isArray(rawPairs) ? rawPairs : [];

  return pairs.map((p: unknown) => {
    const pair = p as Record<string, unknown>;
    return {
      key: String(pair.key ?? ''),
      value: String(pair.value ?? ''),
      confidence: clampConfidence(pair.confidence),
      page: pageNumber,
    };
  });
}

/**
 * Parse a raw JSON string into a DocumentClassification.
 */
export function parseClassificationResponse(
  raw: string,
): DocumentClassification {
  const json = extractJson(raw);

  const alternativeTypes = Array.isArray(json.alternativeTypes)
    ? json.alternativeTypes.map((a: Record<string, unknown>) => ({
        type: validateDocumentType(a.type),
        confidence: clampConfidence(a.confidence),
      }))
    : [];

  return {
    type: validateDocumentType(json.type),
    confidence: clampConfidence(json.confidence),
    alternativeTypes,
  };
}

/**
 * Parse a raw JSON string into a ContentAnswer.
 */
export function parseContentAnswerResponse(
  raw: string,
  question: string,
): ContentAnswer {
  const json = extractJson(raw);

  return {
    question,
    answer: truncate(
      String(json.answer ?? 'Information not found in document.'),
      AI_ANSWER_MAX_LENGTH,
    ),
    confidence: clampConfidence(json.confidence),
    sourcePage: typeof json.sourcePage === 'number' ? json.sourcePage : 0,
    sourceSnippet: String(json.sourceSnippet ?? ''),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Page text helpers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Chunk pages into batches respecting AI_MAX_PAGES_PER_REQUEST.
 */
export function chunkPages(pageTexts: string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < pageTexts.length; i += AI_MAX_PAGES_PER_REQUEST) {
    batches.push(pageTexts.slice(i, i + AI_MAX_PAGES_PER_REQUEST));
  }
  return batches;
}

/**
 * Extract a representative sample from page texts for classification.
 * Takes first page + last page + middle page snippets.
 */
export function extractSampleText(pageTexts: string[]): string {
  if (pageTexts.length === 0) return '';
  if (pageTexts.length === 1) return pageTexts[0].slice(0, 3000);

  const first = pageTexts[0].slice(0, 1000);
  const last = pageTexts[pageTexts.length - 1].slice(0, 1000);
  const mid = pageTexts[Math.floor(pageTexts.length / 2)].slice(0, 1000);

  return `--- FIRST PAGE ---\n${first}\n\n--- MIDDLE ---\n${mid}\n\n--- LAST PAGE ---\n${last}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal utilities
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Extract JSON from AI response that may contain markdown fences.
 */
function extractJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to find first { or [ in the response
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    const start =
      objStart >= 0 && (arrStart < 0 || objStart < arrStart)
        ? objStart
        : arrStart;
    if (start >= 0) {
      try {
        return JSON.parse(cleaned.slice(start));
      } catch {
        // fall through
      }
    }
    return {};
  }
}

function validateDocumentType(value: unknown): DocumentType {
  const valid = DOCUMENT_TYPES.map((d) => d.value as string);
  const s = String(value ?? 'unknown').toLowerCase();
  return (valid.includes(s) ? s : 'unknown') as DocumentType;
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}
