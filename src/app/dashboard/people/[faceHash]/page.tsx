// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Sprint 10 — Person Detail Page
 *
 * Shows all assets containing a specific faceHash.
 * Allows renaming the person and viewing their photo collection.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Loader2,
  Camera,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface PersonAsset {
  _id: string;
  name: string;
  thumbnailBase64?: string;
  thumbnailStorageKey?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const faceHash = decodeURIComponent(params.faceHash as string);

  const [assets, setAssets] = useState<PersonAsset[]>([]);
  const [personName, setPersonName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  /* ── Fetch person's assets ── */
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assets?faceHash=${encodeURIComponent(faceHash)}&limit=200`,
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch (err) {
      console.error('Failed to fetch person assets:', err);
    } finally {
      setLoading(false);
    }
  }, [faceHash]);

  /* ── Fetch person name ── */
  const fetchPersonInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/people?limit=200');
      if (!res.ok) return;
      const data = await res.json();
      const cluster = data.clusters?.find(
        (c: { faceHash: string }) => c.faceHash === faceHash,
      );
      if (cluster?.name) {
        setPersonName(cluster.name);
        setEditName(cluster.name);
      }
    } catch {
      // Silently fail
    }
  }, [faceHash]);

  useEffect(() => {
    void fetchAssets();
    void fetchPersonInfo();
  }, [fetchAssets, fetchPersonInfo]);

  /* ── Save name ── */
  const handleSaveName = useCallback(async () => {
    if (!editName.trim()) return;
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceHash, name: editName.trim() }),
      });
      if (res.ok) {
        setPersonName(editName.trim());
        setEditing(false);
      }
    } catch {
      // Silently fail
    }
  }, [editName, faceHash]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/people"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <User className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="rounded-lg border border-purple-300 px-3 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={() => void handleSaveName()}
                  className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {personName || 'Unknown Person'}
                </h1>
                <button
                  onClick={() => {
                    setEditName(personName || '');
                    setEditing(true);
                  }}
                  className="rounded p-1 text-gray-400 hover:text-purple-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {assets.length} photo{assets.length !== 1 ? 's' : ''} &middot;
              Face ID: {faceHash.slice(0, 12)}...
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && assets.length === 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-12 text-center shadow-sm">
          <Camera className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No photos found
          </h3>
        </div>
      )}

      {/* Photo Grid */}
      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {assets.map((asset) => (
            <div
              key={asset._id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
              onClick={() => router.push(`/dashboard?asset=${asset._id}`)}
            >
              {asset.thumbnailBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.thumbnailBase64}
                  alt={asset.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="truncate text-xs text-white">{asset.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
