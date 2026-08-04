// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { FolderOpen, ChevronRight, CornerLeftUp } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────── */

interface FolderEntry {
 id: string;
 name: string;
 path: string; // parent path from DB, e.g. "/"for root, "/photos/"for sub
}

interface FolderPickerProps {
 /** Flat list of ALL org folders. Each has { id, name, path }. */
 folders: FolderEntry[];
 /** Currently selected display path, e.g. "root/photos". */
 value: string;
 /** Called when the user selects a folder. Passes the display path. */
 onChange: (displayPath: string) => void;
}

/* ─── Helpers ───────────────────────────────────────── */

/** Convert a DB-style parent path to a display path.
 * "/"→ "root"
 * "/photos/"→ "root/photos"
 * "/photos/vacation/"→ "root/photos/vacation"
 */
function dirToDisplay(dir: string): string {
 if (dir === '/') return 'root';
 // dir looks like "/photos/vacation/"
 return 'root' + dir.slice(0, -1); // remove trailing slash
}

/** Full display path for a folder entry */
function folderDisplay(f: FolderEntry): string {
 return 'root' + f.path + f.name;
}

/* ─── Component ─────────────────────────────────────── */

export function FolderPicker({ folders, value, onChange }: FolderPickerProps) {
 const [open, setOpen] = useState(false);
 const [currentDir, setCurrentDir] = useState('/');
 const containerRef = useRef<HTMLDivElement>(null);

 // Close on outside click
 useEffect(() => {
 if (!open) return;
 function handler(e: MouseEvent) {
 if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
 setOpen(false);
 }
 }
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [open]);

 // Children of current directory
 const children = useMemo(
 () => folders.filter((f) => f.path === currentDir).sort((a, b) => a.name.localeCompare(b.name)),
 [folders, currentDir],
 );

 const currentDisplay = dirToDisplay(currentDir);
 const isRoot = currentDir === '/';

 const goUp = () => {
 if (isRoot) return;
 const trimmed = currentDir.slice(0, -1); // "/photos/vacation"→ remove trailing /
 const lastSlash = trimmed.lastIndexOf('/');
 setCurrentDir(trimmed.slice(0, lastSlash + 1) || '/');
 };

 const enterFolder = (f: FolderEntry) => {
 setCurrentDir(f.path + f.name + '/');
 };

 const selectFolder = (displayPath: string) => {
 onChange(displayPath);
 setOpen(false);
 };

 return (
 <div ref={containerRef} className="relative flex-1 min-w-0">
 {/* Trigger button — shows current value or placeholder */}
 <button
 type="button"
 onClick={() => setOpen(!open)}
 className={`flex w-full items-center gap-1.5 rounded border bg-dash-surface px-2 py-1 text-left text-xs outline-none transition ${
 open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-dash-border hover:border-dash-border-hover'
 }`}
 >
 <FolderOpen className="h-3 w-3 shrink-0 text-amber-400"/>
 <span className={`truncate ${value ? 'text-dash-text' : 'text-dash-text-muted'}`}>
 {value || 'Select folder…'}
 </span>
 <ChevronRight className={`ml-auto h-3 w-3 shrink-0 text-dash-text-muted transition ${open ? 'rotate-90' : ''}`} />
 </button>

 {/* Dropdown explorer */}
 {open && (
 <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-dash-border bg-dash-surface shadow-lg">
 {/* Breadcrumb bar */}
 <div className="flex items-center gap-1 border-b border-dash-border bg-dash-muted px-2 py-1.5">
 <FolderOpen className="h-3 w-3 shrink-0 text-dash-text-muted"/>
 <span className="truncate font-mono text-[11px] text-dash-text2">{currentDisplay}/</span>
 </div>

 {/* Entries */}
 <div className="max-h-40 overflow-y-auto py-0.5">
 {/* .. go up */}
 {!isRoot && (
 <button
 onClick={goUp}
 className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-dash-text2 transition hover:bg-dash-muted"
 >
 <CornerLeftUp className="h-3 w-3 text-dash-text-muted"/>
 <span className="font-mono font-medium">..</span>
 <span className="ml-auto text-[10px] text-dash-text-muted">back</span>
 </button>
 )}

 {/* . select current directory */}
 <button
 onClick={() => selectFolder(currentDisplay)}
 className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition ${
 value === currentDisplay
 ? 'bg-blue-50 font-medium text-blue-700'
 : 'text-dash-text2 hover:bg-dash-muted'
 }`}
 >
 <FolderOpen className="h-3 w-3 text-amber-400"/>
 <span className="font-mono font-medium">.</span>
 <span className="ml-auto text-[10px] text-dash-text-muted">select here</span>
 </button>

 {/* Subfolders */}
 {children.length > 0 ? (
 children.map((f) => {
 const fDisplay = folderDisplay(f);
 const selected = value === fDisplay;
 return (
 <button
 key={f.id}
 onClick={() => selectFolder(fDisplay)}
 onDoubleClick={(e) => {
 e.preventDefault();
 enterFolder(f);
 }}
 className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition ${
 selected
 ? 'bg-blue-50 font-medium text-blue-700'
 : 'text-dash-text2 hover:bg-dash-muted'
 }`}
 >
 <FolderOpen className="h-3 w-3 text-amber-400"/>
 <span className="truncate">{f.name}</span>
 <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-dash-text-muted"/>
 </button>
 );
 })
 ) : (
 <p className="px-2.5 py-3 text-center text-[10px] text-dash-text-muted">
 No subfolders
 </p>
 )}
 </div>

 {/* Hint */}
 <div className="border-t border-dash-border bg-dash-muted px-2.5 py-1">
 <p className="text-[10px] text-dash-text-muted">
 Click to select · Double-click to open
 </p>
 </div>
 </div>
 )}
 </div>
 );
}
