// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import {
  ArrowLeft,
  Loader2,
  ImageOff,
  Star,
  FileText,
  Film,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface AlbumAsset {
  _id: string;
  name: string;
  originalName: string;
  thumbnailBase64: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  fileCategory: string;
  isStarred: boolean;
}

interface AlbumDetail {
  _id: string;
  name: string;
  description: string;
  icon: string;
  rules: { field: string; operator: string; value: unknown }[];
  isPreset: boolean;
}

export default function SmartAlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = use(params);
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [assets, setAssets] = useState<AlbumAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAlbum = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/smart-albums/${albumId}?page=${page}&limit=40`,
      );
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setAlbum(data.album);
      setAssets(data.assets || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('[SmartAlbum] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [albumId, page]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'video':
        return <Film className="h-3 w-3" />;
      case 'document':
        return <FileText className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (loading && !album) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-zinc-400">
        <ImageOff className="h-16 w-16" />
        <p>Smart album not found</p>
        <Link
          href="/dashboard/smart-albums"
          className="text-blue-500 hover:underline"
        >
          Back to Smart Albums
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/smart-albums"
          className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="text-3xl">{album.icon}</span>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {album.name}
            </h1>
            {album.isPreset && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Preset
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {total} matching assets
            {album.description ? ` • ${album.description}` : ''}
          </p>
        </div>
      </div>

      {/* Rule summary */}
      <div className="mt-4 flex flex-wrap gap-2">
        {album.rules.map((rule, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <strong className="mr-1">{rule.field}</strong>
            {rule.operator}{' '}
            {rule.operator !== 'exists' ? String(rule.value) : ''}
          </span>
        ))}
      </div>

      {/* Asset Grid */}
      {assets.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-zinc-400">
          <ImageOff className="h-12 w-12" />
          <p>No assets match these rules</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {assets.map((asset) => (
              <Link
                key={asset._id}
                href={`/dashboard?asset=${asset._id}`}
                className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                  {asset.thumbnailBase64 ? (
                    <Image
                      src={asset.thumbnailBase64}
                      alt={asset.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-300">
                      {getCategoryIcon(asset.fileCategory) || (
                        <ImageOff className="h-8 w-8" />
                      )}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Starred badge */}
                  {asset.isStarred && (
                    <div className="absolute right-1 top-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </div>
                  )}
                </div>

                <div className="p-2">
                  <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {asset.name || asset.originalName}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {formatSize(asset.sizeBytes)}
                    {asset.width && asset.height
                      ? ` • ${asset.width}×${asset.height}`
                      : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
