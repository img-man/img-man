// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-2.1 Rich Text Editing Overlay
 *
 * A contentEditable overlay that replaces the plain textarea for inline
 * text editing on the design canvas. Supports per-character formatting
 * (bold, italic, underline) via toolbar + keyboard shortcuts.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type CSSProperties,
} from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  type RichTextParagraph,
  type RichTextSpan,
  richTextToPlain,
  plainToRichText,
  applyTextTransform,
  type TypographyExtras,
  DEFAULT_TYPOGRAPHY,
} from './text-helpers';

/* ─── Types ──────────────────────────────────────────────── */

export interface RichTextEditorProps {
  /** Initial plain text (legacy compat) */
  initialText: string;
  /** Rich text paragraphs (overrides initialText when present) */
  richParagraphs?: RichTextParagraph[];
  /** Element position/size in canvas coords */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Viewport scale (zoom) */
  scale: number;
  /** SVG bounding rect offset from container */
  svgOffset: { left: number; top: number };
  /** Typography props */
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  typography?: Partial<TypographyExtras>;
  /** Callbacks */
  onCommit: (plainText: string, richParagraphs: RichTextParagraph[]) => void;
  onCancel: () => void;
}

/* ─── Inline formatting toolbar ──────────────────────────── */

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

function getSelectionFormatState(): FormatState {
  return {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strikethrough: document.queryCommandState('strikeThrough'),
  };
}

/* ─── Component ──────────────────────────────────────────── */

export function RichTextEditor({
  initialText,
  richParagraphs,
  x,
  y,
  width,
  height,
  scale,
  svgOffset,
  fontSize,
  fontFamily,
  fontWeight,
  fontStyle,
  color,
  textAlign,
  typography,
  onCommit,
  onCancel,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });

  const typo = { ...DEFAULT_TYPOGRAPHY, ...typography };

  // ── Build initial HTML from rich paragraphs or plain text ──
  const buildInitialHTML = useCallback((): string => {
    if (richParagraphs && richParagraphs.length > 0) {
      return richParagraphs
        .map((para) => {
          const spans = para.spans
            .map((s) => {
              let html = escapeHtml(s.text);
              if (s.bold) html = `<b>${html}</b>`;
              if (s.italic) html = `<i>${html}</i>`;
              if (s.underline) html = `<u>${html}</u>`;
              if (s.strikethrough) html = `<s>${html}</s>`;
              if (s.color) html = `<span style="color:${s.color}">${html}</span>`;
              return html;
            })
            .join('');
          return `<div>${spans || '<br>'}</div>`;
        })
        .join('');
    }
    // Legacy plain text
    return initialText
      .split('\n')
      .map((line) => `<div>${escapeHtml(line) || '<br>'}</div>`)
      .join('');
  }, [initialText, richParagraphs]);

  // ── Focus on mount ──
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = buildInitialHTML();
    el.focus();
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update format state on selection change ──
  useEffect(() => {
    const handler = () => setFormatState(getSelectionFormatState());
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // ── Parse HTML back to rich text model ──
  const parseEditorContent = useCallback((): RichTextParagraph[] => {
    const el = editorRef.current;
    if (!el) return plainToRichText(initialText);

    const paragraphs: RichTextParagraph[] = [];
    const children = el.childNodes;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const spans: RichTextSpan[] = [];

      if (child.nodeType === Node.TEXT_NODE) {
        spans.push({ text: child.textContent || '' });
      } else if (child instanceof HTMLElement) {
        const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          const span = extractSpanFormatting(textNode);
          spans.push(span);
        }
      }

      if (spans.length === 0) {
        spans.push({ text: '' });
      }
      paragraphs.push({ spans });
    }

    // If no children parsed, fall back to text content
    if (paragraphs.length === 0) {
      const text = el.textContent || '';
      return plainToRichText(text);
    }

    return paragraphs;
  }, [initialText]);

  // ── Commit ──
  const handleCommit = useCallback(() => {
    const paragraphs = parseEditorContent();
    const plain = richTextToPlain(paragraphs);
    onCommit(plain, paragraphs);
  }, [parseEditorContent, onCommit]);

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape → commit and close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCommit();
        return;
      }
      // Enter without Shift → commit (Shift+Enter = newline like before)
      if (e.key === 'Enter' && !e.shiftKey) {
        // Allow Enter for new lines in rich text mode
        // (unlike the old textarea which committed on Enter)
      }
      // Ctrl+B → Bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold');
        setFormatState(getSelectionFormatState());
      }
      // Ctrl+I → Italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic');
        setFormatState(getSelectionFormatState());
      }
      // Ctrl+U → Underline
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline');
        setFormatState(getSelectionFormatState());
      }
      // Ctrl+Shift+S → Strikethrough
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        document.execCommand('strikeThrough');
        setFormatState(getSelectionFormatState());
      }
      // Stop propagation so canvas shortcuts don't fire
      e.stopPropagation();
    },
    [handleCommit],
  );

  // ── Formatting button handler ──
  const execFormat = useCallback((cmd: string) => {
    document.execCommand(cmd);
    editorRef.current?.focus();
    setFormatState(getSelectionFormatState());
  }, []);

  // ── Positioning ──
  const style: CSSProperties = {
    position: 'absolute',
    left: svgOffset.left + x * scale,
    top: svgOffset.top + y * scale,
    width: width * scale,
    minHeight: height * scale,
    fontSize: fontSize * scale,
    fontFamily,
    fontWeight,
    fontStyle,
    color,
    textAlign,
    letterSpacing: typo.letterSpacing * scale,
    lineHeight: typo.lineHeight,
    background: 'rgba(255,255,255,0.97)',
    border: '2px solid #3b82f6',
    borderRadius: 4,
    padding: 4,
    outline: 'none',
    zIndex: 100,
    boxSizing: 'border-box',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
    caretColor: '#3b82f6',
  };

  return (
    <>
      {/* Inline formatting toolbar */}
      <div
        className="absolute z-[110] flex items-center gap-0.5 rounded-md border border-white/20 bg-gray-900 px-1 py-0.5 shadow-xl"
        style={{
          left: svgOffset.left + x * scale,
          top: svgOffset.top + y * scale - 36,
        }}
      >
        <FmtBtn
          icon={Bold}
          active={formatState.bold}
          onClick={() => execFormat('bold')}
          label="Bold (Ctrl+B)"
        />
        <FmtBtn
          icon={Italic}
          active={formatState.italic}
          onClick={() => execFormat('italic')}
          label="Italic (Ctrl+I)"
        />
        <FmtBtn
          icon={Underline}
          active={formatState.underline}
          onClick={() => execFormat('underline')}
          label="Underline (Ctrl+U)"
        />
        <FmtBtn
          icon={Strikethrough}
          active={formatState.strikethrough}
          onClick={() => execFormat('strikeThrough')}
          label="Strikethrough (Ctrl+Shift+S)"
        />
        <div className="mx-0.5 h-4 w-px bg-white/20" />
        <FmtBtn
          icon={Undo2}
          active={false}
          onClick={() => execFormat('undo')}
          label="Undo"
        />
        <FmtBtn
          icon={Redo2}
          active={false}
          onClick={() => execFormat('redo')}
          label="Redo"
        />
      </div>

      {/* The contentEditable editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleCommit}
        onInput={() => setFormatState(getSelectionFormatState())}
        style={style}
        data-testid="rich-text-editor"
      />
    </>
  );
}

/* ─── Small components ───────────────────────────────────── */

function FmtBtn({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: typeof Bold;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault(); // preserve selection
        onClick();
      }}
      title={label}
      className={`rounded p-1 transition-colors ${
        active
          ? 'bg-blue-500 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={13} />
    </button>
  );
}

/* ─── Utilities ──────────────────────────────────────────── */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Walk up from a text node to determine its formatting context.
 */
function extractSpanFormatting(textNode: Node): RichTextSpan {
  const span: RichTextSpan = { text: textNode.textContent || '' };
  let node: Node | null = textNode.parentNode;

  while (node && node instanceof HTMLElement) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') span.bold = true;
    if (tag === 'i' || tag === 'em') span.italic = true;
    if (tag === 'u') span.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') span.strikethrough = true;
    // Check inline style for color
    if (node.style?.color) span.color = node.style.color;
    node = node.parentNode;
  }

  return span;
}

export default RichTextEditor;
