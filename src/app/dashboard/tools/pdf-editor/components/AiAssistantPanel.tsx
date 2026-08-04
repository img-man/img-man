// SPDX-License-Identifier: Apache-2.0
/**
 * AiAssistantPanel Component — Phase 5, Week 17–18
 *
 * AI-powered document assistant with tabs for:
 * - Summary: Document summarization and key findings
 * - Tables: Extracted table preview
 * - Q&A: Ask questions about the document
 * - Entities: Named entity recognition display
 * - Translate: Translation overlay controls
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Brain,
  FileText,
  Table2,
  MessageSquare,
  Tags,
  Languages,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import type {
  DocumentSummary,
  ExtractedTable,
  ContentAnswer,
  NamedEntity,
  TranslationOverlay,
  DocumentClassification,
  AiTaskResult,
} from '../types';
import {
  DOCUMENT_TYPES,
  SUPPORTED_LANGUAGES,
  ENTITY_TYPES,
} from '../constants';
import {
  getEntityColor,
  getEntityLabel,
} from '../engine/ai-translation-engine';

/* ──────────────────────── Props ──────────────────────── */

type AiTab = 'summary' | 'tables' | 'qa' | 'entities' | 'translate';

interface AiAssistantPanelProps {
  onSummarize: () => void;
  onExtractTables: (page: number) => void;
  onAskQuestion: (question: string) => void;
  onExtractEntities: (page: number) => void;
  onTranslate: (sourceLanguage: string, targetLanguage: string) => void;
  onToggleTranslation: () => void;
  summaryTask: AiTaskResult<DocumentSummary>;
  tablesTask: AiTaskResult<ExtractedTable[]>;
  qaTask: AiTaskResult<ContentAnswer>;
  entitiesTask: AiTaskResult<NamedEntity[]>;
  translationOverlay: TranslationOverlay | null;
  classification: DocumentClassification | null;
  currentPage: number;
  totalPages: number;
}

/* ──────────────────────── Tab config ──────────────────────── */

const AI_TABS: { id: AiTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'summary',
    label: 'Summary',
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  { id: 'tables', label: 'Tables', icon: <Table2 className="h-3.5 w-3.5" /> },
  { id: 'qa', label: 'Q&A', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: 'entities', label: 'Entities', icon: <Tags className="h-3.5 w-3.5" /> },
  {
    id: 'translate',
    label: 'Translate',
    icon: <Languages className="h-3.5 w-3.5" />,
  },
];

/* ──────────────────────── Status indicator ──────────────────────── */

function TaskStatus({ task }: { task: AiTaskResult<unknown> }) {
  if (task.status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing…
      </span>
    );
  }
  if (task.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3 w-3" />
        {task.error ?? 'Failed'}
      </span>
    );
  }
  if (task.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Done
      </span>
    );
  }
  return null;
}

/* ──────────────────────── Component ──────────────────────── */

export default function AiAssistantPanel({
  onSummarize,
  onExtractTables,
  onAskQuestion,
  onExtractEntities,
  onTranslate,
  onToggleTranslation,
  summaryTask,
  tablesTask,
  qaTask,
  entitiesTask,
  translationOverlay,
  classification,
  currentPage,
  totalPages,
}: AiAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<AiTab>('summary');
  const [question, setQuestion] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');

  const handleAskQuestion = useCallback(() => {
    if (question.trim()) {
      onAskQuestion(question.trim());
      setQuestion('');
    }
  }, [question, onAskQuestion]);

  const classificationLabel = useMemo(() => {
    if (!classification) return null;
    const dt = DOCUMENT_TYPES.find((d) => d.value === classification.type);
    return dt ? `${dt.icon} ${dt.label}` : classification.type;
  }, [classification]);

  return (
    <div className="flex h-full flex-col" data-testid="ai-assistant-panel">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--dash-border)' }}
      >
        <Brain className="h-4 w-4" style={{ color: 'var(--im-primary)' }} />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--dash-text)' }}
        >
          AI Assistant
        </span>
        {classificationLabel && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px]"
            style={{
              background: 'var(--dash-surface-hover)',
              color: 'var(--dash-text-muted)',
            }}
          >
            {classificationLabel}
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--dash-border)' }}
      >
        {AI_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] transition-colors"
            style={{
              color:
                activeTab === tab.id
                  ? 'var(--im-primary)'
                  : 'var(--dash-text-muted)',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid var(--im-primary)'
                  : '2px solid transparent',
            }}
            data-testid={`ai-tab-${tab.id}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-3" data-testid="ai-tab-content">
        {/* ═══ Summary ═══ */}
        {activeTab === 'summary' && (
          <div className="space-y-3">
            <button
              onClick={onSummarize}
              disabled={summaryTask.status === 'processing'}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--im-primary)',
                color: 'var(--im-primary-fg)',
              }}
              data-testid="ai-summarize-btn"
            >
              {summaryTask.status === 'processing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {summaryTask.data ? 'Re-summarize' : 'Summarize Document'}
            </button>

            <TaskStatus task={summaryTask} />

            {summaryTask.data && (
              <div className="space-y-2">
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--dash-text)' }}
                >
                  {summaryTask.data.fullSummary}
                </p>

                {summaryTask.data.keyFindings.length > 0 && (
                  <div>
                    <h4
                      className="mb-1 text-[11px] font-medium"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Key Findings
                    </h4>
                    <ul className="space-y-1">
                      {summaryTask.data.keyFindings.map((finding, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-[11px]"
                          style={{ color: 'var(--dash-text)' }}
                        >
                          <span className="mt-0.5 text-green-400">•</span>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className="flex items-center gap-2 text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  <span>
                    Confidence: {Math.round(summaryTask.data.confidence * 100)}%
                  </span>
                  <span>•</span>
                  <span>Type: {summaryTask.data.documentType}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Tables ═══ */}
        {activeTab === 'tables' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExtractTables(currentPage)}
                disabled={tablesTask.status === 'processing'}
                className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--im-primary)',
                  color: 'var(--im-primary-fg)',
                }}
                data-testid="ai-extract-tables-btn"
              >
                {tablesTask.status === 'processing' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Table2 className="h-3.5 w-3.5" />
                )}
                Extract Tables (Page {currentPage})
              </button>
            </div>

            <TaskStatus task={tablesTask} />

            {tablesTask.data && tablesTask.data.length === 0 && (
              <p
                className="text-center text-xs"
                style={{ color: 'var(--dash-text-muted)' }}
              >
                No tables found on this page.
              </p>
            )}

            {tablesTask.data &&
              tablesTask.data.map((table) => (
                <div
                  key={table.id}
                  className="overflow-hidden rounded-md border"
                  style={{ borderColor: 'var(--dash-border)' }}
                >
                  <div
                    className="px-2 py-1 text-[10px]"
                    style={{
                      background: 'var(--dash-surface-hover)',
                      color: 'var(--dash-text-muted)',
                    }}
                  >
                    Table • Confidence: {Math.round(table.confidence * 100)}%
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      {table.headers.length > 0 && (
                        <thead>
                          <tr>
                            {table.headers.map((h, i) => (
                              <th
                                key={i}
                                className="border-b px-2 py-1 text-left font-medium"
                                style={{
                                  borderColor: 'var(--dash-border)',
                                  color: 'var(--dash-text)',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {table.rows.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="border-b px-2 py-1"
                                style={{
                                  borderColor: 'var(--dash-border)',
                                  color: 'var(--dash-text)',
                                }}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {tablesTask.data &&
                      tablesTask.data.length > 0 &&
                      tablesTask.data[0].rows.length > 5 && (
                        <p
                          className="px-2 py-1 text-[10px]"
                          style={{ color: 'var(--dash-text-muted)' }}
                        >
                          +{tablesTask.data[0].rows.length - 5} more rows
                        </p>
                      )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ═══ Q&A ═══ */}
        {activeTab === 'qa' && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                placeholder="Ask about this document…"
                className="flex-1 rounded-md border px-2 py-1.5 text-xs outline-none"
                style={{
                  background: 'var(--dash-surface)',
                  borderColor: 'var(--dash-border)',
                  color: 'var(--dash-text)',
                }}
                data-testid="ai-question-input"
              />
              <button
                onClick={handleAskQuestion}
                disabled={!question.trim() || qaTask.status === 'processing'}
                className="rounded-md px-2 py-1.5 transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--im-primary)',
                  color: 'var(--im-primary-fg)',
                }}
                data-testid="ai-ask-btn"
              >
                {qaTask.status === 'processing' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <TaskStatus task={qaTask} />

            {qaTask.data && (
              <div
                className="rounded-md border p-2"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <p
                  className="mb-1 text-[11px] font-medium"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  Q: {qaTask.data.question}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--dash-text)' }}
                >
                  {qaTask.data.answer}
                </p>
                <div
                  className="mt-1.5 flex items-center gap-2 text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  <span>
                    Confidence: {Math.round(qaTask.data.confidence * 100)}%
                  </span>
                  {qaTask.data.sourcePage > 0 && (
                    <>
                      <span>•</span>
                      <span>Source: Page {qaTask.data.sourcePage}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Entities ═══ */}
        {activeTab === 'entities' && (
          <div className="space-y-3">
            <button
              onClick={() => onExtractEntities(currentPage)}
              disabled={entitiesTask.status === 'processing'}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--im-primary)',
                color: 'var(--im-primary-fg)',
              }}
              data-testid="ai-entities-btn"
            >
              {entitiesTask.status === 'processing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Tags className="h-3.5 w-3.5" />
              )}
              Extract Entities (Page {currentPage})
            </button>

            <TaskStatus task={entitiesTask} />

            {entitiesTask.data && entitiesTask.data.length === 0 && (
              <p
                className="text-center text-xs"
                style={{ color: 'var(--dash-text-muted)' }}
              >
                No entities found on this page.
              </p>
            )}

            {entitiesTask.data && entitiesTask.data.length > 0 && (
              <div className="space-y-1">
                {entitiesTask.data.map((entity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded px-2 py-1 text-[11px]"
                    style={{ background: 'var(--dash-surface-hover)' }}
                  >
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: getEntityColor(entity.type) }}
                    >
                      {getEntityLabel(entity.type)}
                    </span>
                    <span style={{ color: 'var(--dash-text)' }}>
                      {entity.text}
                    </span>
                    {entity.normalizedValue && (
                      <span
                        className="ml-auto text-[10px]"
                        style={{ color: 'var(--dash-text-muted)' }}
                      >
                        → {entity.normalizedValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Translate ═══ */}
        {activeTab === 'translate' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label
                  className="mb-0.5 block text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  From
                </label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full rounded-md border px-2 py-1.5 text-xs"
                  style={{
                    background: 'var(--dash-surface)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                  data-testid="ai-source-lang"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <span
                className="mt-4 text-lg"
                style={{ color: 'var(--dash-text-muted)' }}
              >
                →
              </span>
              <div className="flex-1">
                <label
                  className="mb-0.5 block text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  To
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full rounded-md border px-2 py-1.5 text-xs"
                  style={{
                    background: 'var(--dash-surface)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                  data-testid="ai-target-lang"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => onTranslate(sourceLang, targetLang)}
              disabled={sourceLang === targetLang}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--im-primary)',
                color: 'var(--im-primary-fg)',
              }}
              data-testid="ai-translate-btn"
            >
              <Languages className="h-3.5 w-3.5" />
              Translate Document
            </button>

            {translationOverlay && (
              <div
                className="flex items-center justify-between rounded-md border px-2 py-1.5"
                style={{ borderColor: 'var(--dash-border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--dash-text)' }}>
                  {translationOverlay.blocks.length} translation block(s)
                </span>
                <button
                  onClick={onToggleTranslation}
                  className="rounded p-1 transition-colors"
                  style={{ color: 'var(--dash-text-muted)' }}
                  data-testid="ai-toggle-overlay"
                >
                  {translationOverlay.visible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
