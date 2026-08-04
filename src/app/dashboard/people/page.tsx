// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Sprint 10 — 10.2: People Albums Page
 *
 * Shows face clusters grouped by faceHash.
 * Users can name people, pin favorites, and click to see all their photos.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Pencil,
  Pin,
  Loader2,
  UserCircle,
  Camera,
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';

/* ─── Types ────────────────────────────────────────────────── */

interface PersonCluster {
  faceHash: string;
  photoCount: number;
  sampleThumbnails: string[];
  sampleAssetIds: string[];
  personId: string | null;
  name: string | null;
  isPinned: boolean;
  dominantEmotion?: string;
  avgConfidence?: number;
}

interface PeopleStats {
  totalFaces: number;
  totalPhotosWithFaces: number;
  namedPeople: number;
}

/* ─── Component ────────────────────────────────────────────── */

export default function PeoplePage() {
  const router = useRouter();
  const [clusters, setClusters] = useState<PersonCluster[]>([]);
  const [stats, setStats] = useState<PeopleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  /* ── Fetch ── */
  const fetchPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/people?minPhotos=1&limit=100');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setClusters(data.clusters ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPeople();
  }, [fetchPeople]);

  /* ── Name person ── */
  const handleSaveName = useCallback(
    async (faceHash: string) => {
      if (!editName.trim()) return;
      try {
        const res = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faceHash, name: editName.trim() }),
        });
        if (res.ok) {
          setEditingHash(null);
          setEditName('');
          void fetchPeople();
        }
      } catch {
        // Silently fail
      }
    },
    [editName, fetchPeople],
  );

  /* ── Pin toggle ── */
  const handlePinToggle = useCallback(
    async (personId: string, currentPinned: boolean) => {
      try {
        await fetch(`/api/people/${personId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPinned: !currentPinned }),
        });
        void fetchPeople();
      } catch {
        // Silently fail
      }
    },
    [fetchPeople],
  );

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            People
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Face clusters detected across your library
          </p>
        </div>
      </div>

      {/* Stats Banner */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {clusters.length}
            </div>
            <div className="text-xs text-gray-500">Unique Faces</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalPhotosWithFaces}
            </div>
            <div className="text-xs text-gray-500">Photos with Faces</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {stats.namedPeople}
            </div>
            <div className="text-xs text-gray-500">Named People</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => void fetchPeople()}
            className="mt-2 text-sm text-red-500 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && clusters.length === 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-12 text-center shadow-sm">
          <UserCircle className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No faces detected yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload photos with people to see face clusters here.
          </p>
        </div>
      )}

      {/* People Grid */}
      {!loading && clusters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {clusters.map((cluster) => (
            <div
              key={cluster.faceHash}
              className="group relative rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Thumbnail Grid (2x2 preview) */}
              <div
                className="aspect-square grid grid-cols-2 grid-rows-2 gap-0.5 bg-gray-200 dark:bg-gray-700"
                onClick={() =>
                  router.push(
                    `/dashboard/people/${encodeURIComponent(cluster.faceHash)}`,
                  )
                }
              >
                {Array.from({ length: 4 }).map((_, i) => {
                  const thumb = cluster.sampleThumbnails[i];
                  if (!thumb) {
                    return (
                      <div
                        key={i}
                        className="bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                      >
                        <Camera className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                      </div>
                    );
                  }
                  const isBase64 =
                    thumb.startsWith('data:') || thumb.length > 200;
                  return (
                    <div key={i} className="overflow-hidden">
                      {isBase64 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <Camera className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info Bar */}
              <div className="p-3">
                {editingHash === cluster.faceHash ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          void handleSaveName(cluster.faceHash);
                        if (e.key === 'Escape') setEditingHash(null);
                      }}
                      placeholder="Enter name..."
                      className="flex-1 rounded border border-purple-300 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      autoFocus
                    />
                    <button
                      onClick={() => void handleSaveName(cluster.faceHash)}
                      className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingHash(null)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {cluster.name || 'Unknown Person'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {cluster.photoCount} photo
                        {cluster.photoCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingHash(cluster.faceHash);
                          setEditName(cluster.name || '');
                        }}
                        title="Name this person"
                        className="rounded p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {cluster.personId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePinToggle(
                              cluster.personId!,
                              cluster.isPinned,
                            );
                          }}
                          title={cluster.isPinned ? 'Unpin' : 'Pin'}
                          className={`rounded p-1 ${
                            cluster.isPinned
                              ? 'text-purple-600'
                              : 'text-gray-400 hover:text-purple-600'
                          } hover:bg-purple-50 dark:hover:bg-purple-900/20`}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
