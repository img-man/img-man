// SPDX-License-Identifier: Apache-2.0
'use client';

import { Keyboard, X } from 'lucide-react';

/* ─── Shortcut categories ────────────────────────────────────────────── */
const SHORTCUT_SECTIONS = [
  {
    category: 'Tools',
    items: [
      { keys: 'V', desc: 'Select tool' },
      { keys: 'T', desc: 'Text tool' },
      { keys: 'R', desc: 'Rectangle tool' },
      { keys: 'O', desc: 'Ellipse tool' },
      { keys: 'L', desc: 'Line tool' },
      { keys: 'H', desc: 'Hand / pan tool' },
      { keys: 'P', desc: 'Pen / marker tool' },
    ],
  },
  {
    category: 'Edit',
    items: [
      { keys: 'Ctrl+A', desc: 'Select all' },
      { keys: 'Ctrl+C', desc: 'Copy' },
      { keys: 'Ctrl+X', desc: 'Cut' },
      { keys: 'Ctrl+V', desc: 'Paste' },
      { keys: 'Ctrl+D', desc: 'Duplicate' },
      { keys: 'Ctrl+Z', desc: 'Undo' },
      { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
      { keys: 'Delete', desc: 'Delete selected' },
    ],
  },
  {
    category: 'Arrange',
    items: [
      { keys: ']', desc: 'Bring forward' },
      { keys: '[', desc: 'Send backward' },
      { keys: 'Ctrl+G', desc: 'Group selection' },
      { keys: 'Ctrl+Shift+G', desc: 'Ungroup' },
    ],
  },
  {
    category: 'View',
    items: [
      { keys: 'Ctrl++', desc: 'Zoom in' },
      { keys: 'Ctrl+-', desc: 'Zoom out' },
      { keys: 'Ctrl+0', desc: 'Reset zoom & pan' },
      { keys: 'Ctrl+1', desc: 'Zoom to 100%' },
      { keys: 'Space + drag', desc: 'Pan canvas' },
    ],
  },
  {
    category: 'Move',
    items: [
      { keys: 'Arrow keys', desc: 'Nudge 1px' },
      { keys: 'Shift+Arrow', desc: 'Nudge 10px' },
    ],
  },
  {
    category: 'Save',
    items: [
      { keys: 'Ctrl+S', desc: 'Save design' },
      { keys: 'Ctrl+Shift+S', desc: 'Open version history' },
      { keys: 'Ctrl+/', desc: 'Toggle this dialog' },
    ],
  },
] as const;

/* ─── Props ──────────────────────────────────────────────────────────── */
interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ShortcutsDialog({
  open,
  onClose,
}: ShortcutsDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[80vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-dash-text2" />
            <h3 className="text-sm font-semibold text-dash-text">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text2 hover:bg-dash-muted transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.category} className="mb-4 last:mb-0">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text2/70">
                {section.category}
              </h4>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <div
                    key={item.desc}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-dash-muted/50"
                  >
                    <span className="text-xs text-dash-text2">{item.desc}</span>
                    <div className="flex gap-1">
                      {item.keys.split('+').map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-dash-border bg-dash-bg px-1.5 py-0.5 text-[10px] font-mono text-dash-text"
                        >
                          {k.trim()}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
