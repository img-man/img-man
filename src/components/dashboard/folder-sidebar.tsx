// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  Share2,
  FolderInput,
  Lock,
  Shield,
} from 'lucide-react';
import { ShareDialog } from '@/components/dashboard/share-dialog';
import { FolderPickerDialog } from '@/components/dashboard/folder-picker-dialog';
import { useEmbedScope } from '@/app/embed/dashboard/embed-scope-context';

interface FolderItem {
  _id: string;
  name: string;
  parentId: string | null;
  path?: string;
  accessMode?: 'restricted' | 'flexible';
  accessModeInherited?: boolean;
}

interface FolderSidebarProps {
  activeFolderId?: string | null;
  onSelect: (folderId: string | null) => void;
  refreshKey?: number;
}

interface FolderNode extends FolderItem {
  children: FolderNode[];
}

function buildTree(folders: FolderItem[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  // Create nodes
  for (const f of folders) {
    map.set(f._id, { ...f, children: [] });
  }

  // Build tree
  for (const f of folders) {
    const node = map.get(f._id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort each level alphabetically
  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

function FolderTreeNode({
  node,
  depth,
  activeFolderId,
  onSelect,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onCreateChild,
  onShare,
  onMove,
  onAccessSettings,
  hideAccessSettings,
}: {
  node: FolderNode;
  depth: number;
  activeFolderId: string | null;
  onSelect: (id: string) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onShare: (id: string, name: string) => void;
  onMove: (id: string, name: string) => void;
  onAccessSettings?: (id: string, name: string) => void;
  hideAccessSettings?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const isActive = activeFolderId === node._id;
  const isExpanded = expanded.has(node._id);
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRenameSubmit = () => {
    if (renameName.trim() && renameName !== node.name) {
      onRename(node._id, renameName.trim());
    } else {
      setRenameName(node.name);
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-0.5 rounded-lg py-1 pr-1 transition ${
          isActive
            ? 'bg-dash-muted font-semibold text-dash-text'
            : 'text-dash-text2 hover:bg-dash-muted'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node._id);
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition hover:bg-dash-surface-hover ${
            !hasChildren ? 'invisible' : ''
          }`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Folder icon + name */}
        <button
          onClick={() => onSelect(node._id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-dash-text-muted" />
          )}
          {node.accessMode === 'restricted' && (
            <span title="Restricted folder">
              <Lock className="h-2.5 w-2.5 shrink-0 text-red-500" />
            </span>
          )}
          {isRenaming ? (
            <input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenameName(node.name);
                  setIsRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-dash-border px-1 py-0.5 text-xs outline-none focus:border-primary"
              autoFocus
            />
          ) : (
            <span className="truncate text-xs">{node.name}</span>
          )}
        </button>

        {/* Context menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-dash-text-muted opacity-0 transition hover:bg-dash-surface-hover hover:text-dash-text2 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-dash-border bg-dash-surface py-1 shadow-lg">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsRenaming(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 transition hover:bg-dash-muted"
              >
                <Pencil className="h-3 w-3" /> Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onCreateChild(node._id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 transition hover:bg-dash-muted"
              >
                <FolderPlus className="h-3 w-3" /> New subfolder
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onShare(node._id, node.name);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 transition hover:bg-dash-muted"
              >
                <Share2 className="h-3 w-3" /> Share
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onMove(node._id, node.name);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 transition hover:bg-dash-muted"
              >
                <FolderInput className="h-3 w-3" /> Move to…
              </button>
              {!hideAccessSettings && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onAccessSettings?.(node._id, node.name);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 transition hover:bg-dash-muted"
                >
                  <Shield className="h-3 w-3" /> Access settings
                </button>
              )}
              <div className="my-1 border-t border-dash-border" />
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(node._id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        node.children.map((child) => (
          <FolderTreeNode
            key={child._id}
            node={child}
            depth={depth + 1}
            activeFolderId={activeFolderId}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
            onCreateChild={onCreateChild}
            onShare={onShare}
            onMove={onMove}
            onAccessSettings={onAccessSettings}
            hideAccessSettings={hideAccessSettings}
          />
        ))}
    </div>
  );
}

export function FolderSidebar({
  activeFolderId,
  onSelect,
  refreshKey,
}: FolderSidebarProps) {
  const { isEmbed } = useEmbedScope();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);
  const [shareFolderName, setShareFolderName] = useState('');
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [moveFolderName, setMoveFolderName] = useState('');
  const [accessFolderId, setAccessFolderId] = useState<string | null>(null);
  const [accessFolderName, setAccessFolderName] = useState('');
  const [accessFolderMode, setAccessFolderMode] = useState<
    'restricted' | 'flexible'
  >('flexible');
  const [savingAccess, setSavingAccess] = useState(false);

  const loadFolders = useCallback(async () => {
    // Fetch all folders (no parentId filter) to build full tree
    const res = await fetch('/api/folders');
    const data = await res.json();
    return data.folders ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchFolders() {
      const nextFolders = await loadFolders();
      if (!cancelled) {
        setFolders(nextFolders);
      }
    }

    void fetchFolders();

    return () => {
      cancelled = true;
    };
  }, [loadFolders, refreshKey]);

  const refreshFolders = useCallback(async () => {
    const nextFolders = await loadFolders();
    setFolders(nextFolders);
  }, [loadFolders]);

  const tree = buildTree(folders);

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), parentId: createParentId }),
    });
    setNewName('');
    setCreating(false);
    setCreateParentId(null);
    await refreshFolders();
  };

  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await refreshFolders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this folder? Assets will be moved to root.')) return;
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    if (activeFolderId === id) onSelect(null);
    await refreshFolders();
  };

  const handleCreateChild = (parentId: string) => {
    setCreateParentId(parentId);
    setCreating(true);
    // Auto-expand parent
    setExpanded((prev) => new Set(prev).add(parentId));
  };

  const handleMoveFolder = async (targetParentId: string | null) => {
    if (!moveFolderId) return;
    try {
      await fetch(`/api/folders/${moveFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: targetParentId }),
      });
      await refreshFolders();
    } catch (err) {
      console.error('Move folder failed:', err);
    }
  };

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-dash-border bg-dash-surface">
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-dash-text2">
          Folders
        </span>
        <button
          onClick={() => {
            setCreateParentId(null);
            setCreating(!creating);
          }}
          className="rounded p-0.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text2"
          title="New folder"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex gap-1 border-b border-dash-border p-2"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            className="min-w-0 flex-1 rounded border border-dash-border px-2 py-1 text-xs outline-none focus:border-primary"
            placeholder={createParentId ? 'Subfolder name' : 'Folder name'}
          />
          <button
            type="submit"
            className="rounded bg-[var(--im-primary)] px-2 py-1 text-xs font-medium text-[var(--im-primary-fg)]"
          >
            Add
          </button>
        </form>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {/* All Assets */}
        <button
          onClick={() => onSelect(null)}
          className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs transition ${
            !activeFolderId
              ? 'bg-dash-muted font-semibold text-dash-text'
              : 'text-dash-text2 hover:bg-dash-muted'
          }`}
        >
          <Folder className="h-3.5 w-3.5 text-dash-text-muted" />
          All Assets
        </button>

        {/* Folder Tree */}
        {tree.map((node) => (
          <FolderTreeNode
            key={node._id}
            node={node}
            depth={0}
            activeFolderId={activeFolderId ?? null}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={handleToggle}
            onRename={handleRename}
            onDelete={handleDelete}
            onCreateChild={handleCreateChild}
            onShare={(id, name) => {
              setShareFolderId(id);
              setShareFolderName(name);
            }}
            onMove={(id, name) => {
              setMoveFolderId(id);
              setMoveFolderName(name);
            }}
            onAccessSettings={(id, name) => {
              const folder = folders.find((f) => f._id === id);
              setAccessFolderId(id);
              setAccessFolderName(name);
              setAccessFolderMode(folder?.accessMode ?? 'flexible');
            }}
            hideAccessSettings={isEmbed}
          />
        ))}
      </nav>

      {/* Folder count */}
      <div className="border-t border-dash-border px-3 py-2">
        <p className="text-[10px] text-dash-text-muted">
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Share Dialog */}
      {shareFolderId && (
        <ShareDialog
          open={!!shareFolderId}
          onClose={() => {
            setShareFolderId(null);
            setShareFolderName('');
          }}
          targetId={shareFolderId}
          targetType="folder"
          targetName={shareFolderName}
        />
      )}

      {/* Move Folder Picker */}
      {moveFolderId && (
        <FolderPickerDialog
          open={!!moveFolderId}
          onClose={() => {
            setMoveFolderId(null);
            setMoveFolderName('');
          }}
          onSelect={(targetParentId) => handleMoveFolder(targetParentId)}
          title={`Move "${moveFolderName}"`}
          description="Select destination folder"
          excludeIds={[moveFolderId]}
          showRoot
        />
      )}

      {/* Folder Access Quick-Toggle Dialog */}
      {accessFolderId && !isEmbed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAccessFolderId(null)}
        >
          <div
            className="w-80 rounded-xl border border-dash-border bg-dash-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-dash-text-muted" />
              <h3 className="text-sm font-semibold text-dash-text">
                Folder Access
              </h3>
            </div>
            <p className="mb-3 text-xs text-dash-text2">
              <span className="font-medium">{accessFolderName}</span>
            </p>

            <div className="space-y-2 mb-4">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${accessFolderMode === 'flexible' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-dash-border hover:border-dash-input-border'}`}
              >
                <input
                  type="radio"
                  name="accessMode"
                  value="flexible"
                  checked={accessFolderMode === 'flexible'}
                  onChange={() => setAccessFolderMode('flexible')}
                  className="accent-emerald-600"
                />
                <div>
                  <p className="text-xs font-medium text-dash-text">Flexible</p>
                  <p className="text-[10px] text-dash-text-muted">
                    Visible to all org members
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${accessFolderMode === 'restricted' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-dash-border hover:border-dash-input-border'}`}
              >
                <input
                  type="radio"
                  name="accessMode"
                  value="restricted"
                  checked={accessFolderMode === 'restricted'}
                  onChange={() => setAccessFolderMode('restricted')}
                  className="accent-red-600"
                />
                <div>
                  <p className="text-xs font-medium text-dash-text">
                    Restricted
                  </p>
                  <p className="text-[10px] text-dash-text-muted">
                    Only allowed members & groups
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-dash-text-muted">
                <input
                  type="checkbox"
                  id="cascade-access"
                  className="accent-blue-600 h-3 w-3"
                  defaultChecked
                />
                Apply to subfolders
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAccessFolderId(null)}
                  className="rounded-lg border border-dash-border px-3 py-1 text-xs text-dash-text2 hover:bg-dash-muted transition"
                >
                  Cancel
                </button>
                <button
                  disabled={savingAccess}
                  onClick={async () => {
                    setSavingAccess(true);
                    const cascade =
                      (
                        document.getElementById(
                          'cascade-access',
                        ) as HTMLInputElement
                      )?.checked ?? false;
                    try {
                      await fetch(`/api/folders/${accessFolderId}/access`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          accessMode: accessFolderMode,
                          cascade,
                        }),
                      });
                      await refreshFolders();
                    } catch (err) {
                      console.error('Update folder access failed:', err);
                    }
                    setSavingAccess(false);
                    setAccessFolderId(null);
                  }}
                  className="rounded-lg bg-[var(--im-primary)] px-3 py-1 text-xs font-medium text-[var(--im-primary-fg)] hover:opacity-90 transition disabled:opacity-50"
                >
                  {savingAccess ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
