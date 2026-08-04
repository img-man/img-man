// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  Loader2,
  FolderOpen,
  X,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface SmartAlbumData {
  _id: string;
  name: string;
  description: string;
  icon: string;
  rules: { field: string; operator: string; value: unknown }[];
  cachedCount: number;
  isPreset: boolean;
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: 'is',
  ne: 'is not',
  contains: 'contains',
  startsWith: 'starts with',
  gt: 'greater than',
  lt: 'less than',
  gte: 'at least',
  lte: 'at most',
  exists: 'exists',
  regex: 'matches',
};

const FIELD_OPTIONS = [
  { value: 'originalName', label: 'File Name' },
  { value: 'mimeType', label: 'MIME Type' },
  { value: 'fileCategory', label: 'Category' },
  { value: 'sizeBytes', label: 'Size (bytes)' },
  { value: 'width', label: 'Width' },
  { value: 'height', label: 'Height' },
  { value: 'isStarred', label: 'Starred' },
  { value: 'exif.camera', label: 'Camera' },
  { value: 'exif.gps', label: 'GPS Data' },
  { value: 'faces.0', label: 'Has Faces' },
  { value: 'tags', label: 'Tags' },
];

const OPERATOR_OPTIONS = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'exists', label: 'exists' },
];

export default function SmartAlbumsPage() {
  const [albums, setAlbums] = useState<SmartAlbumData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [newRules, setNewRules] = useState([
    { field: 'originalName', operator: 'contains', value: '' },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smart-albums?includePresets=true');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setAlbums(data.albums || []);
    } catch (err) {
      console.error('[SmartAlbums] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const handleCreate = async () => {
    if (!newName.trim() || !newRules[0]?.value) return;
    setCreating(true);
    try {
      const res = await fetch('/api/smart-albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          icon: newIcon,
          rules: newRules.filter((r) => r.value),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        setNewRules([
          { field: 'originalName', operator: 'contains', value: '' },
        ]);
        await fetchAlbums();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this smart album?')) return;
    await fetch(`/api/smart-albums/${id}`, { method: 'DELETE' });
    setAlbums((prev) => prev.filter((a) => a._id !== id));
  };

  const addRule = () => {
    setNewRules([
      ...newRules,
      { field: 'originalName', operator: 'contains', value: '' },
    ]);
  };

  const removeRule = (idx: number) => {
    if (newRules.length <= 1) return;
    setNewRules(newRules.filter((_, i) => i !== idx));
  };

  const updateRule = (idx: number, updates: Partial<(typeof newRules)[0]>) => {
    setNewRules(newRules.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Smart Albums
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Auto-populated albums based on rules
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          New Smart Album
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Create Smart Album
          </h2>

          <div className="mt-4 flex gap-3">
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-12 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-lg dark:border-zinc-600 dark:bg-zinc-700"
              maxLength={2}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Album name..."
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Rules (all must match)
            </label>
            {newRules.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(idx, { field: e.target.value })}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) =>
                    updateRule(idx, { operator: e.target.value })
                  }
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                >
                  {OPERATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {rule.operator !== 'exists' && (
                  <input
                    value={String(rule.value)}
                    onChange={(e) => updateRule(idx, { value: e.target.value })}
                    placeholder="Value..."
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                )}

                {newRules.length > 1 && (
                  <button
                    onClick={() => removeRule(idx)}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addRule}
              className="text-xs font-medium text-blue-600 hover:text-blue-500"
            >
              + Add rule
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Album Grid */}
      {albums.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-zinc-400">
          <FolderOpen className="h-16 w-16" />
          <p className="text-lg font-medium">No smart albums yet</p>
          <p className="text-sm">
            Click &quot;New Smart Album&quot; to create one
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <div
              key={album._id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            >
              <Link
                href={`/dashboard/smart-albums/${album._id}`}
                className="block"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{album.icon}</span>
                    <div>
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                        {album.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {album.cachedCount} assets
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
                </div>

                {album.description && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {album.description}
                  </p>
                )}

                {/* Rule chips */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {album.rules.slice(0, 3).map((rule, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    >
                      {rule.field}{' '}
                      {OPERATOR_LABELS[rule.operator] || rule.operator}{' '}
                      {rule.operator !== 'exists'
                        ? String(rule.value).slice(0, 20)
                        : ''}
                    </span>
                  ))}
                  {album.rules.length > 3 && (
                    <span className="text-[10px] text-zinc-400">
                      +{album.rules.length - 3} more
                    </span>
                  )}
                </div>
              </Link>

              {/* Actions (not on presets) */}
              {!album.isPreset && (
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(album._id);
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {album.isPreset && (
                <div className="absolute right-2 top-2">
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Preset
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
