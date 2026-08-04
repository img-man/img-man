// SPDX-License-Identifier: Apache-2.0
/**
 * AccessibilityPanel Component — Phase 5, Week 20
 *
 * Sidebar panel for PDF/UA accessibility management:
 * - Run accessibility audit and view score
 * - Issue list grouped by severity
 * - Structure tag tree editor
 * - Reading order editor
 * - Color contrast checker
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Accessibility,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import type {
  AccessibilityReport,
  AccessibilityIssue,
  AccessibilityIssueLevel,
  StructureTag,
  ReadingOrderItem,
  ColorContrastResult,
} from '../types';
import { ACCESSIBILITY_RULES } from '../constants';
import {
  getTagTypeLabel,
  getTagTypeIcon,
  checkColorContrast,
} from '../engine/accessibility-engine';

/* ──────────────────────── Props ──────────────────────── */

type A11yTab = 'audit' | 'tags' | 'order' | 'contrast';

interface AccessibilityPanelProps {
  onRunAudit: () => void;
  onFixIssue: (issue: AccessibilityIssue) => void;
  onSelectTag: (tagId: string) => void;
  onUpdateTagAltText: (tagId: string, altText: string) => void;
  onMoveReadingOrderUp: (tagId: string) => void;
  onMoveReadingOrderDown: (tagId: string) => void;
  onRemoveFromReadingOrder: (tagId: string) => void;
  report: AccessibilityReport | null;
  tags: StructureTag[];
  readingOrder: ReadingOrderItem[];
  isAuditing: boolean;
}

/* ──────────────────────── Level Icons ──────────────────────── */

const LEVEL_ICONS: Record<
  AccessibilityIssueLevel,
  { icon: LucideIcon; color: string }
> = {
  error: { icon: AlertCircle, color: '#EF4444' },
  warning: { icon: AlertTriangle, color: '#F59E0B' },
  info: { icon: Info, color: '#3B82F6' },
};

/* ──────────────────────── Component ──────────────────────── */

export default function AccessibilityPanel({
  onRunAudit,
  onFixIssue,
  onSelectTag,
  onUpdateTagAltText,
  onMoveReadingOrderUp,
  onMoveReadingOrderDown,
  onRemoveFromReadingOrder,
  report,
  tags,
  readingOrder,
  isAuditing,
}: AccessibilityPanelProps) {
  const [activeTab, setActiveTab] = useState<A11yTab>('audit');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(16);
  const [isBold, setIsBold] = useState(false);

  const contrastResult = useMemo(
    () => checkColorContrast(fgColor, bgColor, fontSize, isBold),
    [fgColor, bgColor, fontSize, isBold],
  );

  const issuesByLevel = useMemo(() => {
    if (!report) return { error: [], warning: [], info: [] };
    return {
      error: report.issues.filter((i) => i.level === 'error'),
      warning: report.issues.filter((i) => i.level === 'warning'),
      info: report.issues.filter((i) => i.level === 'info'),
    };
  }, [report]);

  const toggleTagExpanded = useCallback((tagId: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col" data-testid="accessibility-panel">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--dash-border)' }}
      >
        <Accessibility
          className="h-4 w-4"
          style={{ color: 'var(--im-primary)' }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--dash-text)' }}
        >
          Accessibility
        </span>
        {report && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{
              background:
                report.score >= 80
                  ? '#10B981'
                  : report.score >= 50
                    ? '#F59E0B'
                    : '#EF4444',
            }}
            data-testid="a11y-score"
          >
            {report.score}/100
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--dash-border)' }}
      >
        {(['audit', 'tags', 'order', 'contrast'] as A11yTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="flex-1 px-2 py-1.5 text-[11px] font-medium capitalize transition-colors"
            style={{
              color:
                activeTab === t
                  ? 'var(--im-primary)'
                  : 'var(--dash-text-muted)',
              borderBottom:
                activeTab === t
                  ? '2px solid var(--im-primary)'
                  : '2px solid transparent',
            }}
            data-testid={`a11y-tab-${t}`}
          >
            {t === 'order' ? 'Read Order' : t}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 overflow-y-auto p-3"
        data-testid="a11y-tab-content"
      >
        {/* ═══ Audit Tab ═══ */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <button
              onClick={onRunAudit}
              disabled={isAuditing}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--im-primary)',
                color: 'var(--im-primary-fg)',
              }}
              data-testid="a11y-run-audit-btn"
            >
              {isAuditing ? (
                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Accessibility className="h-3.5 w-3.5" />
              )}
              {report ? 'Re-run Audit' : 'Run Accessibility Audit'}
            </button>

            {report && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div
                    className="rounded-md p-2"
                    style={{ background: 'var(--dash-surface-hover)' }}
                  >
                    <p className="text-lg font-bold text-green-400">
                      {report.passedChecks}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Passed
                    </p>
                  </div>
                  <div
                    className="rounded-md p-2"
                    style={{ background: 'var(--dash-surface-hover)' }}
                  >
                    <p className="text-lg font-bold text-red-400">
                      {issuesByLevel.error.length}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Errors
                    </p>
                  </div>
                  <div
                    className="rounded-md p-2"
                    style={{ background: 'var(--dash-surface-hover)' }}
                  >
                    <p className="text-lg font-bold text-yellow-400">
                      {issuesByLevel.warning.length}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Warnings
                    </p>
                  </div>
                </div>

                {/* Issue list */}
                {(
                  ['error', 'warning', 'info'] as AccessibilityIssueLevel[]
                ).map((level) => {
                  const issues = issuesByLevel[level];
                  if (issues.length === 0) return null;
                  const { icon: Icon, color } = LEVEL_ICONS[level];

                  return (
                    <div key={level}>
                      <h4
                        className="mb-1 flex items-center gap-1 text-[11px] font-medium capitalize"
                        style={{ color }}
                      >
                        <Icon className="h-3 w-3" />
                        {level}s ({issues.length})
                      </h4>
                      <div className="space-y-1">
                        {issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded border px-2 py-1.5 text-[11px]"
                            style={{ borderColor: 'var(--dash-border)' }}
                          >
                            <p style={{ color: 'var(--dash-text)' }}>
                              {issue.description}
                            </p>
                            <p
                              className="mt-0.5"
                              style={{ color: 'var(--dash-text-muted)' }}
                            >
                              💡 {issue.suggestion}
                            </p>
                            <button
                              onClick={() => onFixIssue(issue)}
                              className="mt-1 rounded px-2 py-0.5 text-[10px] transition-colors"
                              style={{
                                background: 'var(--dash-surface-hover)',
                                color: 'var(--im-primary)',
                              }}
                              data-testid={`a11y-fix-${issue.id}`}
                            >
                              Fix
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ═══ Tags Tab ═══ */}
        {activeTab === 'tags' && (
          <div className="space-y-1">
            {tags.length === 0 && (
              <p
                className="text-center text-xs py-4"
                style={{ color: 'var(--dash-text-muted)' }}
              >
                No structure tags found. Run auto-tag to generate.
              </p>
            )}
            {tags.map((tag) => (
              <TagTreeNode
                key={tag.id}
                tag={tag}
                depth={0}
                expanded={expandedTags}
                onToggle={toggleTagExpanded}
                onSelect={onSelectTag}
                onUpdateAltText={onUpdateTagAltText}
              />
            ))}
          </div>
        )}

        {/* ═══ Reading Order Tab ═══ */}
        {activeTab === 'order' && (
          <div className="space-y-1">
            {readingOrder.length === 0 && (
              <p
                className="text-center text-xs py-4"
                style={{ color: 'var(--dash-text-muted)' }}
              >
                No reading order defined. Run audit to generate.
              </p>
            )}
            {readingOrder.map((item, idx) => (
              <div
                key={item.tagId}
                className="flex items-center gap-2 rounded px-2 py-1 text-[11px]"
                style={{ background: 'var(--dash-surface-hover)' }}
              >
                <span
                  className="w-5 text-center font-mono text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  {item.order}
                </span>
                <span className="flex-1" style={{ color: 'var(--dash-text)' }}>
                  {item.tagId}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  P{item.page}
                </span>
                <button
                  onClick={() => onMoveReadingOrderUp(item.tagId)}
                  disabled={idx === 0}
                  className="rounded p-0.5 disabled:opacity-30"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onMoveReadingOrderDown(item.tagId)}
                  disabled={idx === readingOrder.length - 1}
                  className="rounded p-0.5 disabled:opacity-30"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRemoveFromReadingOrder(item.tagId)}
                  className="rounded p-0.5 hover:text-red-400"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Contrast Tab ═══ */}
        {activeTab === 'contrast' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-[11px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  Foreground
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-0"
                    data-testid="a11y-fg-color"
                  />
                  <input
                    type="text"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="flex-1 rounded border px-2 py-1 text-xs font-mono"
                    style={{
                      background: 'var(--dash-surface)',
                      borderColor: 'var(--dash-border)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  className="mb-1 block text-[11px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-0"
                    data-testid="a11y-bg-color"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-1 rounded border px-2 py-1 text-xs font-mono"
                    style={{
                      background: 'var(--dash-surface)',
                      borderColor: 'var(--dash-border)',
                      color: 'var(--dash-text)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label
                  className="mb-1 block text-[11px]"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  Font Size (pt)
                </label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 16)}
                  min={1}
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  style={{
                    background: 'var(--dash-surface)',
                    borderColor: 'var(--dash-border)',
                    color: 'var(--dash-text)',
                  }}
                  data-testid="a11y-font-size"
                />
              </div>
              <label
                className="mt-4 flex items-center gap-1.5 text-xs cursor-pointer"
                style={{ color: 'var(--dash-text)' }}
              >
                <input
                  type="checkbox"
                  checked={isBold}
                  onChange={(e) => setIsBold(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                  data-testid="a11y-bold"
                />
                Bold
              </label>
            </div>

            {/* Preview */}
            <div
              className="rounded-md border p-3"
              style={{ borderColor: 'var(--dash-border)' }}
            >
              <div
                className="mb-2 rounded p-2 text-center"
                style={{
                  background: bgColor,
                  color: fgColor,
                  fontSize: `${fontSize}px`,
                  fontWeight: isBold ? 'bold' : 'normal',
                }}
              >
                Sample Text
              </div>

              {contrastResult && (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--dash-text-muted)' }}>
                      Contrast Ratio
                    </span>
                    <span
                      className="font-mono font-medium"
                      style={{ color: 'var(--dash-text)' }}
                    >
                      {contrastResult.ratio}:1
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--dash-text-muted)' }}>
                      WCAG AA
                    </span>
                    {contrastResult.meetsAA ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Pass
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertCircle className="h-3 w-3" /> Fail
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--dash-text-muted)' }}>
                      WCAG AAA
                    </span>
                    {contrastResult.meetsAAA ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Pass
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertCircle className="h-3 w-3" /> Fail
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────── Tag tree node (recursive) ──────────────────────── */

function TagTreeNode({
  tag,
  depth,
  expanded,
  onToggle,
  onSelect,
  onUpdateAltText,
}: {
  tag: StructureTag;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdateAltText: (id: string, altText: string) => void;
}) {
  const hasChildren = tag.children.length > 0;
  const isExpanded = expanded.has(tag.id);
  const [editingAlt, setEditingAlt] = useState(false);
  const [altText, setAltText] = useState(tag.altText ?? '');

  const handleSaveAlt = useCallback(() => {
    onUpdateAltText(tag.id, altText);
    setEditingAlt(false);
  }, [tag.id, altText, onUpdateAltText]);

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] cursor-pointer transition-colors hover:bg-[var(--dash-surface-hover)]"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onSelect(tag.id)}
        data-testid={`tag-node-${tag.id}`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(tag.id);
            }}
            className="p-0.5"
            style={{ color: 'var(--dash-text-muted)' }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-[10px]">{getTagTypeIcon(tag.type)}</span>
        <span style={{ color: 'var(--dash-text)' }}>
          {getTagTypeLabel(tag.type)}
        </span>
        <span
          className="ml-auto text-[10px]"
          style={{ color: 'var(--dash-text-muted)' }}
        >
          P{tag.page}
        </span>
      </div>

      {tag.type === 'figure' && (
        <div className="ml-8 mt-0.5 mb-0.5">
          {editingAlt ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="flex-1 rounded border px-1.5 py-0.5 text-[10px]"
                style={{
                  background: 'var(--dash-surface)',
                  borderColor: 'var(--dash-border)',
                  color: 'var(--dash-text)',
                }}
                data-testid={`tag-alt-input-${tag.id}`}
              />
              <button
                onClick={handleSaveAlt}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  background: 'var(--im-primary)',
                  color: 'var(--im-primary-fg)',
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingAlt(true)}
              className="text-[10px] underline"
              style={{
                color: tag.altText ? 'var(--dash-text-muted)' : '#EF4444',
              }}
            >
              {tag.altText ? `Alt: ${tag.altText}` : '⚠ Add alt text'}
            </button>
          )}
        </div>
      )}

      {hasChildren &&
        isExpanded &&
        tag.children.map((child) => (
          <TagTreeNode
            key={child.id}
            tag={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            onUpdateAltText={onUpdateAltText}
          />
        ))}
    </div>
  );
}
