// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Dynamic import — SSR disabled for Polotno
const DesignEditor = dynamic(() => import('@/components/design/editor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-dash-muted">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm text-dash-text2">Loading Design Studio...</p>
      </div>
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

interface DesignData {
  _id: string;
  name: string;
  width: number;
  height: number;
  jsonState: object;
  thumbnailUrl?: string;
}

interface UserAsset {
  _id: string;
  name: string;
  url: string; // thumbnail for display (base64 or signed URL)
  fullUrl: string; // full-resolution proxy URL for adding to canvas
  mimeType: string;
}

export default function DesignEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const [design, setDesign] = useState<DesignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

  // Fetch design data
  useEffect(() => {
    async function loadDesign() {
      try {
        const res = await fetch(`/api/designs/${id}`);
        if (!res.ok) {
          const statusMsg =
            res.status === 404 ? 'Design not found' : 'Failed to load design';
          setError(statusMsg);
          return;
        }
        const data = await res.json();
        setDesign(data.design);
      } catch (err) {
        console.error('Failed to load design:', err);
        setError('Failed to load design');
      } finally {
        setLoading(false);
      }
    }
    loadDesign();
  }, [id]);

  // Fetch user's assets for the "My Library"panel
  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch('/api/assets?limit=100&mimeType=image/');
        if (res.ok) {
          const data = await res.json();
          // Map assets to include proper display URLs.
          // The list API returns thumbnailBase64 (inline data URI) or
          // thumbnailUrl (signed GCS URL) but NOT a generic "url"field.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: UserAsset[] = (data.assets ?? []).map((a: any) => ({
            _id: String(a._id),
            name: a.name || a.originalName || 'Untitled',
            url:
              a.thumbnailBase64 ||
              a.thumbnailUrl ||
              `/api/assets/download?assetId=${a._id}&size=small&inline=1`,
            fullUrl: `/api/assets/download?assetId=${a._id}&size=original&inline=1`,
            mimeType: a.mimeType || 'image/png',
          }));
          setUserAssets(mapped);
        }
      } catch (err) {
        // Non-critical, just won't show assets
        console.warn('Failed to load assets:', err);
      }
    }
    loadAssets();
  }, []);

  // Save handler — persists JSON state to DB
  const handleSave = useCallback(
    async (jsonState: object) => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/designs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonState }),
        });
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    },
    [id],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !design) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-dash-text2">
          {error || 'Design not found'}
        </p>
        <Link
          href="/dashboard/designs"
          className="flex items-center gap-2 text-sm text-[var(--im-primary)] hover:text-[var(--im-primary)]/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Designs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Compact breadcrumb bar */}
      <div className="flex items-center gap-3 border-b border-dash-border bg-dash-surface px-4 py-1.5">
        <Link
          href="/dashboard/designs"
          className="flex items-center gap-1 text-xs text-dash-text-muted hover:text-dash-text2 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Designs
        </Link>
        <span className="text-dash-text-muted">/</span>
        <span className="text-xs font-medium text-dash-text2">
          {design.name}
        </span>

        {/* Save status indicator */}
        <div className="ml-auto text-xs">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-dash-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-500">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500">Save failed</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DesignEditor
          designId={design._id}
          initialState={design.jsonState}
          width={design.width}
          height={design.height}
          onSave={handleSave}
          userAssets={userAssets}
        />
      </div>
    </div>
  );
}
