// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
 X,
 Folder,
 FolderOpen,
 ChevronRight,
 ChevronDown,
 Loader2,
 Home,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface FolderItem {
 _id: string;
 name: string;
 parentId: string | null;
 path?: string;
}

interface FolderNode extends FolderItem {
 children: FolderNode[];
}

interface FolderPickerDialogProps {
 open: boolean;
 onClose: () => void;
 onSelect: (folderId: string | null) => void;
 title?: string;
 description?: string;
 /** Folder IDs to exclude from the tree (e.g., the folder being moved + its descendants) */
 excludeIds?: string[];
 /** Whether to show "Root (All Assets)"as an option */
 showRoot?: boolean;
}

/* ─── Helpers ──────────────────────────────────────────── */

function buildTree(
 folders: FolderItem[],
 excludeIds: Set<string>,
): FolderNode[] {
 const map = new Map<string, FolderNode>();
 const roots: FolderNode[] = [];

 // Create nodes (excluding specified IDs)
 for (const f of folders) {
 if (excludeIds.has(f._id)) continue;
 map.set(f._id, { ...f, children: [] });
 }

 // Build tree
 for (const f of folders) {
 if (excludeIds.has(f._id)) continue;
 const node = map.get(f._id)!;
 if (f.parentId && map.has(f.parentId)) {
 map.get(f.parentId)!.children.push(node);
 } else {
 roots.push(node);
 }
 }

 // Sort alphabetically
 const sortNodes = (nodes: FolderNode[]) => {
 nodes.sort((a, b) => a.name.localeCompare(b.name));
 nodes.forEach((n) => sortNodes(n.children));
 };
 sortNodes(roots);

 return roots;
}

/** Collect all descendant folder IDs (for excluding when moving) */
function collectDescendantIds(
 folders: FolderItem[],
 folderId: string,
): string[] {
 const result: string[] = [];
 const queue = [folderId];
 while (queue.length > 0) {
 const current = queue.shift()!;
 for (const f of folders) {
 if (f.parentId === current) {
 result.push(f._id);
 queue.push(f._id);
 }
 }
 }
 return result;
}

/* ─── Tree Node ────────────────────────────────────────── */

function PickerNode({
 node,
 depth,
 selectedId,
 onSelect,
 expanded,
 onToggle,
}: {
 node: FolderNode;
 depth: number;
 selectedId: string | null;
 onSelect: (id: string) => void;
 expanded: Set<string>;
 onToggle: (id: string) => void;
}) {
 const isExpanded = expanded.has(node._id);
 const isSelected = selectedId === node._id;
 const hasChildren = node.children.length > 0;

 return (
 <div>
 <button
 onClick={() => onSelect(node._id)}
 className={`group flex w-full items-center gap-1 rounded-lg py-1.5 pr-2 text-left transition ${
 isSelected
 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
 : 'text-dash-text2 dark:text-dash-text-muted hover:bg-dash-surface-hover/50'
 }`}
 style={{ paddingLeft: `${8 + depth * 20}px` }}
 >
 {/* Expand/collapse */}
 <span
 onClick={(e) => {
 e.stopPropagation();
 onToggle(node._id);
 }}
 className={`flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-dash-surface-hover ${
 !hasChildren ? 'invisible' : 'cursor-pointer'
 }`}
 >
 {isExpanded ? (
 <ChevronDown className="h-3 w-3 text-dash-text2"/>
 ) : (
 <ChevronRight className="h-3 w-3 text-dash-text2"/>
 )}
 </span>

 {isExpanded ? (
 <FolderOpen className="h-4 w-4 shrink-0 text-amber-500"/>
 ) : (
 <Folder className="h-4 w-4 shrink-0 text-dash-text-muted"/>
 )}

 <span className="ml-1 truncate text-sm">{node.name}</span>
 </button>

 {isExpanded &&
 node.children.map((child) => (
 <PickerNode
 key={child._id}
 node={child}
 depth={depth + 1}
 selectedId={selectedId}
 onSelect={onSelect}
 expanded={expanded}
 onToggle={onToggle}
 />
 ))}
 </div>
 );
}

/* ─── Component ────────────────────────────────────────── */

export function FolderPickerDialog({
 open,
 onClose,
 onSelect,
 title = 'Move to folder',
 description,
 excludeIds = [],
 showRoot = true,
}: FolderPickerDialogProps) {
 const [folders, setFolders] = useState<FolderItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [expanded, setExpanded] = useState<Set<string>>(new Set());

 const fetchFolders = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/folders');
 const data = await res.json();
 setFolders(data.folders ?? []);
 } catch {
 // silent
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 if (open) {
 setSelectedId(null);
 fetchFolders();
 }
 }, [open, fetchFolders]);

 const handleToggle = useCallback((id: string) => {
 setExpanded((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }, []);

 const handleConfirm = () => {
 onSelect(selectedId);
 onClose();
 };

 if (!open) return null;

 // Build exclude set: the folder itself + all its descendants
 const allExcludeIds = new Set(excludeIds);
 for (const id of excludeIds) {
 for (const desc of collectDescendantIds(folders, id)) {
 allExcludeIds.add(desc);
 }
 }

 const tree = buildTree(folders, allExcludeIds);

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
 <div
 className="w-full max-w-md rounded-xl border border-dash-border bg-dash-surface shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between border-b border-dash-border px-5 py-4">
 <div>
 <h3 className="text-base font-semibold text-dash-text">
 {title}
 </h3>
 {description && (
 <p className="mt-0.5 text-xs text-dash-text2">
 {description}
 </p>
 )}
 </div>
 <button
 onClick={onClose}
 className="rounded-md p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>

 {/* Body */}
 <div className="max-h-[400px] overflow-y-auto p-3">
 {loading ? (
 <div className="flex justify-center py-8">
 <Loader2 className="h-5 w-5 animate-spin text-dash-text-muted"/>
 </div>
 ) : (
 <div className="space-y-0.5">
 {/* Root option */}
 {showRoot && (
 <button
 onClick={() => setSelectedId(null)}
 className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
 selectedId === null
 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
 : 'text-dash-text2 dark:text-dash-text-muted hover:bg-dash-surface-hover/50'
 }`}
 >
 <Home className="h-4 w-4"/>
 Root (All Assets)
 </button>
 )}

 {/* Folder tree */}
 {tree.map((node) => (
 <PickerNode
 key={node._id}
 node={node}
 depth={0}
 selectedId={selectedId}
 onSelect={setSelectedId}
 expanded={expanded}
 onToggle={handleToggle}
 />
 ))}

 {tree.length === 0 && !showRoot && (
 <p className="py-4 text-center text-sm text-dash-text-muted">
 No folders available
 </p>
 )}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex justify-end gap-2 border-t border-dash-border px-5 py-3">
 <button
 onClick={onClose}
 className="rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirm}
 className="rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:opacity-90"
 >
 Move Here
 </button>
 </div>
 </div>
 </div>
 );
}

export { collectDescendantIds };
