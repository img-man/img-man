// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for ai-document-engine.ts — Phase 5, Week 17
 *
 * Covers prompt builders, response parsers, task state management,
 * page chunking, sample text extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  createIdleTask,
  markProcessing,
  markCompleted,
  markFailed,
  buildSummarizationPrompt,
  buildTableExtractionPrompt,
  buildKeyValueExtractionPrompt,
  buildClassificationPrompt,
  buildContentQAPrompt,
  parseSummaryResponse,
  parseTableResponse,
  parseKeyValueResponse,
  parseClassificationResponse,
  parseContentAnswerResponse,
  chunkPages,
  extractSampleText,
} from '@/app/dashboard/tools/pdf-editor/engine/ai-document-engine';
import type { AiTaskResult } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Task State Management ──────────────── */

describe('Task state management', () => {
  it('creates an idle task', () => {
    const task = createIdleTask<string>();
    expect(task.status).toBe('idle');
    expect(task.data).toBeNull();
    expect(task.error).toBeNull();
    expect(task.startedAt).toBeNull();
    expect(task.completedAt).toBeNull();
  });

  it('marks a task as processing', () => {
    const task = createIdleTask<string>();
    const processing = markProcessing(task);
    expect(processing.status).toBe('processing');
    expect(processing.startedAt).toBeInstanceOf(Date);
    expect(processing.completedAt).toBeNull();
    expect(processing.error).toBeNull();
  });

  it('marks a task as completed with data', () => {
    const task = markProcessing(createIdleTask<string>());
    const completed = markCompleted(task, 'hello');
    expect(completed.status).toBe('completed');
    expect(completed.data).toBe('hello');
    expect(completed.error).toBeNull();
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  it('marks a task as failed with error', () => {
    const task = markProcessing(createIdleTask<string>());
    const failed = markFailed(task, 'something went wrong');
    expect(failed.status).toBe('failed');
    expect(failed.data).toBeNull();
    expect(failed.error).toBe('something went wrong');
    expect(failed.completedAt).toBeInstanceOf(Date);
  });
});

/* ──────────────── Prompt Builders ──────────────── */

describe('buildSummarizationPrompt', () => {
  it('includes model name and page content', () => {
    const result = buildSummarizationPrompt(['Page 1 text', 'Page 2 text']);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.systemPrompt).toContain('document analysis');
    expect(result.userPrompt).toContain('PAGE 1');
    expect(result.userPrompt).toContain('PAGE 2');
  });

  it('clamps pages to max per request', () => {
    const pages = Array.from({ length: 30 }, (_, i) => `Page ${i + 1}`);
    const result = buildSummarizationPrompt(pages);
    expect(result.userPrompt).toContain('PAGE 20');
    expect(result.userPrompt).not.toContain('PAGE 21');
  });
});

describe('buildTableExtractionPrompt', () => {
  it('includes page number', () => {
    const result = buildTableExtractionPrompt('table data here', 3);
    expect(result.userPrompt).toContain('Page 3');
    expect(result.systemPrompt).toContain('table');
  });
});

describe('buildKeyValueExtractionPrompt', () => {
  it('includes page number and data extraction context', () => {
    const result = buildKeyValueExtractionPrompt('Invoice #12345', 1);
    expect(result.userPrompt).toContain('Page 1');
    expect(result.systemPrompt).toContain('key-value');
  });
});

describe('buildClassificationPrompt', () => {
  it('includes document types in system prompt', () => {
    const result = buildClassificationPrompt('This is a legal contract...');
    expect(result.systemPrompt).toContain('invoice');
    expect(result.systemPrompt).toContain('contract');
    expect(result.systemPrompt).toContain('legal');
  });

  it('truncates long sample text', () => {
    const longText = 'A'.repeat(5000);
    const result = buildClassificationPrompt(longText);
    expect(result.userPrompt.length).toBeLessThanOrEqual(3000);
  });
});

describe('buildContentQAPrompt', () => {
  it('includes the question and document context', () => {
    const result = buildContentQAPrompt('What is the total?', [
      'Invoice total: $100',
    ]);
    expect(result.userPrompt).toContain('What is the total?');
    expect(result.userPrompt).toContain('Invoice total: $100');
  });
});

/* ──────────────── Response Parsers ──────────────── */

describe('parseSummaryResponse', () => {
  it('parses valid JSON summary', () => {
    const raw = JSON.stringify({
      fullSummary: 'This is a test document.',
      keyFindings: ['Finding 1', 'Finding 2'],
      pageSummaries: { '1': 'Page 1 summary', '2': 'Page 2 summary' },
      documentType: 'report',
      confidence: 0.95,
    });

    const result = parseSummaryResponse(raw);
    expect(result.fullSummary).toBe('This is a test document.');
    expect(result.keyFindings).toEqual(['Finding 1', 'Finding 2']);
    expect(result.pageSummaries.get(1)).toBe('Page 1 summary');
    expect(result.documentType).toBe('report');
    expect(result.confidence).toBe(0.95);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('handles markdown-fenced JSON', () => {
    const raw = '```json\n{"fullSummary": "Test", "confidence": 0.8}\n```';
    const result = parseSummaryResponse(raw);
    expect(result.fullSummary).toBe('Test');
    expect(result.confidence).toBe(0.8);
  });

  it('falls back to unknown for invalid document type', () => {
    const raw = JSON.stringify({
      documentType: 'alien-report',
      confidence: 0.5,
    });
    const result = parseSummaryResponse(raw);
    expect(result.documentType).toBe('unknown');
  });

  it('clamps confidence to 0-1 range', () => {
    const raw = JSON.stringify({ confidence: 1.5 });
    const result = parseSummaryResponse(raw);
    expect(result.confidence).toBe(1);
  });

  it('handles completely invalid JSON', () => {
    const result = parseSummaryResponse('not json at all');
    expect(result.fullSummary).toBe('');
    expect(result.documentType).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});

describe('parseTableResponse', () => {
  it('parses an array of tables', () => {
    const raw = JSON.stringify([
      {
        headers: ['Name', 'Value'],
        rows: [
          ['A', '1'],
          ['B', '2'],
        ],
        confidence: 0.9,
      },
    ]);
    const result = parseTableResponse(raw, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('table-1-0');
    expect(result[0].headers).toEqual(['Name', 'Value']);
    expect(result[0].rows).toEqual([
      ['A', '1'],
      ['B', '2'],
    ]);
    expect(result[0].confidence).toBe(0.9);
  });

  it('parses nested tables object', () => {
    const raw = JSON.stringify({
      tables: [{ headers: ['H'], rows: [], confidence: 0.7 }],
    });
    const result = parseTableResponse(raw, 2);
    expect(result).toHaveLength(1);
    expect(result[0].page).toBe(2);
  });

  it('returns empty array for no tables', () => {
    const result = parseTableResponse('[]', 1);
    expect(result).toEqual([]);
  });
});

describe('parseKeyValueResponse', () => {
  it('parses key-value pairs', () => {
    const raw = JSON.stringify([
      { key: 'Invoice #', value: '12345', confidence: 0.95 },
      { key: 'Total', value: '$100.00', confidence: 0.88 },
    ]);
    const result = parseKeyValueResponse(raw, 1);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('Invoice #');
    expect(result[0].value).toBe('12345');
    expect(result[0].page).toBe(1);
  });

  it('handles empty response', () => {
    const result = parseKeyValueResponse('[]', 1);
    expect(result).toEqual([]);
  });
});

describe('parseClassificationResponse', () => {
  it('parses classification with alternatives', () => {
    const raw = JSON.stringify({
      type: 'invoice',
      confidence: 0.92,
      alternativeTypes: [{ type: 'receipt', confidence: 0.7 }],
    });
    const result = parseClassificationResponse(raw);
    expect(result.type).toBe('invoice');
    expect(result.confidence).toBe(0.92);
    expect(result.alternativeTypes).toHaveLength(1);
    expect(result.alternativeTypes[0].type).toBe('receipt');
  });

  it('falls back to unknown for invalid type', () => {
    const raw = JSON.stringify({ type: 'spaceship', confidence: 0.1 });
    const result = parseClassificationResponse(raw);
    expect(result.type).toBe('unknown');
  });
});

describe('parseContentAnswerResponse', () => {
  it('parses a content answer', () => {
    const raw = JSON.stringify({
      answer: 'The total is $100.',
      confidence: 0.85,
      sourcePage: 2,
      sourceSnippet: '...total amount: $100...',
    });
    const result = parseContentAnswerResponse(raw, 'What is the total?');
    expect(result.question).toBe('What is the total?');
    expect(result.answer).toBe('The total is $100.');
    expect(result.sourcePage).toBe(2);
    expect(result.confidence).toBe(0.85);
  });

  it('falls back when answer not found', () => {
    const result = parseContentAnswerResponse('{}', 'Question?');
    expect(result.answer).toContain('Information not found');
    expect(result.confidence).toBe(0);
  });
});

/* ──────────────── Page Helpers ──────────────── */

describe('chunkPages', () => {
  it('returns a single chunk for small docs', () => {
    const pages = ['p1', 'p2', 'p3'];
    expect(chunkPages(pages)).toEqual([pages]);
  });

  it('splits into multiple chunks for large docs', () => {
    const pages = Array.from({ length: 50 }, (_, i) => `p${i + 1}`);
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(20);
    expect(chunks[2]).toHaveLength(10);
  });

  it('returns empty array for empty input', () => {
    expect(chunkPages([])).toEqual([]);
  });
});

describe('extractSampleText', () => {
  it('returns first page for single page doc', () => {
    const result = extractSampleText(['Only page content']);
    expect(result).toContain('Only page content');
  });

  it('includes first, middle, and last page', () => {
    const pages = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
    const result = extractSampleText(pages);
    expect(result).toContain('First');
    expect(result).toContain('Fifth');
    expect(result).toContain('FIRST PAGE');
    expect(result).toContain('LAST PAGE');
  });

  it('returns empty string for empty input', () => {
    expect(extractSampleText([])).toBe('');
  });
});
