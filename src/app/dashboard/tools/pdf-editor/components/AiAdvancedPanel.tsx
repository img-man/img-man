// SPDX-License-Identifier: Apache-2.0
/**
 * AiAdvancedPanel — Phase 6, Week 23
 *
 * Left sidebar panel with five sub-tabs:
 * 1. PII Detection — Scan pages, review & accept/reject detections
 * 2. NL Editing — Natural-language command input + history
 * 3. Auto-fill — AI-suggested form field fills
 * 4. Bookmarks — Auto-generated bookmark tree
 * 5. Smart Crop — Per-page trim suggestions
 */

'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  MessageCircle,
  Type,
  Bookmark,
  Crop,
  Play,
  Check,
  X,
  ChevronRight,
  Send,
  Loader2,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import type {
  PiiDetection,
  NlEditCommand,
  SmartAutofillSuggestion,
  GeneratedBookmark,
  SmartCropResult,
} from '../types';

/* ──────────────── Props ──────────────── */

interface AiAdvancedPanelProps {
  /* PII */
  piiDetections: PiiDetection[];
  onScanPii: () => void;
  onAcceptPii: (id: string) => void;
  onRejectPii: (id: string) => void;
  onAcceptAllPii: () => void;

  /* NL Editing */
  nlCommands: NlEditCommand[];
  onExecuteNlCommand: (command: string) => void;

  /* Autofill */
  autofillSuggestions: SmartAutofillSuggestion[];
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;

  /* Bookmarks */
  generatedBookmarks: GeneratedBookmark[];
  onApplyBookmarks: () => void;

  /* Smart Crop */
  smartCropResults: SmartCropResult[];
  onApplyCrop: (page: number) => void;

  /* Context */
  currentPage: number;
  totalPages: number;
  isProcessing?: boolean;
}

/* ──────────────── Sub-tab definition ──────────────── */

type SubTab = 'pii' | 'nl' | 'autofill' | 'bookmarks' | 'crop';

const SUB_TABS: {
  id: SubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'pii', label: 'PII', icon: ShieldAlert },
  { id: 'nl', label: 'NL Edit', icon: MessageCircle },
  { id: 'autofill', label: 'Autofill', icon: Type },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'crop', label: 'Crop', icon: Crop },
];

/* ──────────────── PII Detection sub-panel ──────────────── */

function PiiSubPanel({
  detections,
  onScan,
  onAccept,
  onReject,
  onAcceptAll,
  isProcessing,
}: {
  detections: PiiDetection[];
  onScan: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  isProcessing?: boolean;
}) {
  const pending = detections.filter((d) => !d.accepted);
  const accepted = detections.filter((d) => d.accepted);

  return (
    <div className="space-y-2 p-2">
      <button
        onClick={onScan}
        disabled={isProcessing}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--im-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--im-primary-fg)] hover:opacity-90 disabled:opacity-50"
      >
        {isProcessing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Scan for PII
      </button>

      {detections.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-[var(--dash-text-muted)]">
          <span>
            {pending.length} pending · {accepted.length} accepted
          </span>
          {pending.length > 0 && (
            <button
              onClick={onAcceptAll}
              className="text-[var(--im-primary)] hover:underline"
            >
              Accept All
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        {detections.map((d) => (
          <div
            key={d.id}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
              d.accepted
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-[var(--dash-border)]'
            }`}
          >
            <span className="shrink-0 rounded bg-red-500/20 px-1 py-0.5 text-[9px] font-medium text-red-600">
              {d.type}
            </span>
            <span className="flex-1 truncate text-[var(--dash-text)]">
              &quot;{d.text}&quot;
            </span>
            <span className="text-[9px] text-[var(--dash-text-muted)]">
              p.{d.page}
            </span>
            {!d.accepted && (
              <>
                <button
                  onClick={() => onAccept(d.id)}
                  className="rounded p-0.5 text-green-500 hover:bg-green-500/10"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onReject(d.id)}
                  className="rounded p-0.5 text-red-500 hover:bg-red-500/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {detections.length === 0 && !isProcessing && (
        <p className="py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
          Scan the document to detect personal information.
        </p>
      )}
    </div>
  );
}

/* ──────────────── NL Editing sub-panel ──────────────── */

function NlEditSubPanel({
  commands,
  onExecute,
  isProcessing,
}: {
  commands: NlEditCommand[];
  onExecute: (cmd: string) => void;
  isProcessing?: boolean;
}) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !isProcessing) {
      onExecute(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Command history */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            className="rounded-md border border-[var(--dash-border)] px-2 py-1.5 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-[var(--im-primary)]" />
              <span className="text-[var(--dash-text)]">{cmd.input}</span>
            </div>
            <div className="mt-0.5 pl-4">
              {cmd.status === 'pending' && (
                <span className="text-[10px] text-[var(--dash-text-muted)]">
                  Pending…
                </span>
              )}
              {cmd.status === 'executing' && (
                <span className="flex items-center gap-1 text-[10px] text-blue-500">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Executing…
                </span>
              )}
              {cmd.status === 'completed' && (
                <span className="flex items-center gap-1 text-[10px] text-green-500">
                  <CheckCheck className="h-2.5 w-2.5" />
                  {cmd.result || 'Done'}
                </span>
              )}
              {cmd.status === 'failed' && (
                <span className="flex items-center gap-1 text-[10px] text-red-500">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {cmd.result || 'Failed'}
                </span>
              )}
            </div>
          </div>
        ))}

        {commands.length === 0 && (
          <div className="py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
            <p>Describe what you&apos;d like to do:</p>
            <p className="mt-1 italic">
              &quot;Remove all headers from page 2&quot;
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1 border-t border-[var(--dash-border)] p-2">
        <input
          className="flex-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-1 text-[11px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]"
          placeholder="Type a command…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          className="rounded-md bg-[var(--im-primary)] px-2 text-[var(--im-primary-fg)] disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────── Autofill sub-panel ──────────────── */

function AutofillSubPanel({
  suggestions,
  onAccept,
  onReject,
}: {
  suggestions: SmartAutofillSuggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const pending = suggestions.filter((s) => !s.accepted);

  return (
    <div className="space-y-1.5 p-2">
      {suggestions.length > 0 && (
        <p className="text-[10px] text-[var(--dash-text-muted)]">
          {pending.length} pending suggestion{pending.length !== 1 ? 's' : ''}
        </p>
      )}
      {suggestions.map((s) => (
        <div
          key={s.fieldId}
          className={`rounded-md border px-2 py-1.5 text-[11px] ${
            s.accepted
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-[var(--dash-border)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--dash-text)]">
              {s.fieldLabel}
            </span>
            <span className="text-[9px] text-[var(--dash-text-muted)]">
              {Math.round(s.confidence * 100)}%
            </span>
          </div>
          <p className="mt-0.5 text-[var(--dash-text-muted)]">
            {s.suggestedValue}
          </p>
          {!s.accepted && (
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => onAccept(s.fieldId)}
                className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600 hover:bg-green-500/20"
              >
                Accept
              </button>
              <button
                onClick={() => onReject(s.fieldId)}
                className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/20"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
      {suggestions.length === 0 && (
        <p className="py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
          No form fields detected for auto-fill.
        </p>
      )}
    </div>
  );
}

/* ──────────────── Bookmarks sub-panel ──────────────── */

function BookmarksSubPanel({
  bookmarks,
  onApply,
}: {
  bookmarks: GeneratedBookmark[];
  onApply: () => void;
}) {
  return (
    <div className="p-2 space-y-2">
      {bookmarks.length > 0 && (
        <button
          onClick={onApply}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--im-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--im-primary-fg)] hover:opacity-90"
        >
          <CheckCheck className="h-3 w-3" />
          Apply All Bookmarks
        </button>
      )}
      <div className="space-y-0.5">
        {bookmarks.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-1 text-[11px]"
            style={{ paddingLeft: `${(b.level - 1) * 12}px` }}
          >
            <Bookmark className="h-3 w-3 shrink-0 text-[var(--im-primary)]" />
            <span className="truncate text-[var(--dash-text)]">{b.title}</span>
            <span className="ml-auto text-[9px] text-[var(--dash-text-muted)]">
              p.{b.page}
            </span>
          </div>
        ))}
      </div>
      {bookmarks.length === 0 && (
        <p className="py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
          No bookmarks generated yet.
        </p>
      )}
    </div>
  );
}

/* ──────────────── Smart Crop sub-panel ──────────────── */

function SmartCropSubPanel({
  results,
  onApply,
  currentPage,
}: {
  results: SmartCropResult[];
  onApply: (page: number) => void;
  currentPage: number;
}) {
  const currentResult = results.find((r) => r.page === currentPage);

  return (
    <div className="p-2 space-y-2">
      {currentResult ? (
        <div className="rounded-md border border-[var(--dash-border)] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-[var(--dash-text)]">
              Page {currentPage}
            </span>
            <span className="text-[10px] text-[var(--dash-text-muted)]">
              {Math.round(currentResult.confidence * 100)}% confidence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-[var(--dash-text-muted)]">
            <span>X: {currentResult.cropped.x}px</span>
            <span>Y: {currentResult.cropped.y}px</span>
            <span>W: {currentResult.cropped.width}px</span>
            <span>H: {currentResult.cropped.height}px</span>
          </div>
          <button
            onClick={() => onApply(currentPage)}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-[var(--im-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--im-primary-fg)] hover:opacity-90"
          >
            <Crop className="h-3 w-3" />
            Apply Crop
          </button>
        </div>
      ) : (
        <p className="py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
          No crop suggestion for page {currentPage}.
        </p>
      )}

      {results.length > 0 && (
        <div className="text-[10px] text-[var(--dash-text-muted)]">
          {results.length} page{results.length !== 1 ? 's' : ''} with crop
          suggestions
        </div>
      )}
    </div>
  );
}

/* ──────────────── Main panel ──────────────── */

export default function AiAdvancedPanel(props: AiAdvancedPanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('pii');

  return (
    <div
      className="flex h-full flex-col text-xs"
      data-testid="ai-advanced-panel"
    >
      {/* Sub-tab icons */}
      <div className="flex border-b border-[var(--dash-border)]">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-[var(--im-primary)] text-[var(--im-primary)]'
                  : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'pii' && (
          <PiiSubPanel
            detections={props.piiDetections}
            onScan={props.onScanPii}
            onAccept={props.onAcceptPii}
            onReject={props.onRejectPii}
            onAcceptAll={props.onAcceptAllPii}
            isProcessing={props.isProcessing}
          />
        )}
        {activeTab === 'nl' && (
          <NlEditSubPanel
            commands={props.nlCommands}
            onExecute={props.onExecuteNlCommand}
            isProcessing={props.isProcessing}
          />
        )}
        {activeTab === 'autofill' && (
          <AutofillSubPanel
            suggestions={props.autofillSuggestions}
            onAccept={props.onAcceptSuggestion}
            onReject={props.onRejectSuggestion}
          />
        )}
        {activeTab === 'bookmarks' && (
          <BookmarksSubPanel
            bookmarks={props.generatedBookmarks}
            onApply={props.onApplyBookmarks}
          />
        )}
        {activeTab === 'crop' && (
          <SmartCropSubPanel
            results={props.smartCropResults}
            onApply={props.onApplyCrop}
            currentPage={props.currentPage}
          />
        )}
      </div>
    </div>
  );
}
