'use client';

import { useEffect, useState } from 'react';

import { api, getAccessToken, getApiBaseUrl } from '@/lib/api/client';

export function AssetPreview({
  assetId,
  alt,
  className,
}: {
  assetId: string;
  alt?: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setSrc(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        // Prefer metadata URL when absolute; otherwise fetch authenticated content.
        const meta = await api.getAsset(assetId);
        const url = meta.url.startsWith('http')
          ? meta.url
          : `${getApiBaseUrl()}${meta.url.startsWith('/') ? '' : '/'}${meta.url}`;

        const token = getAccessToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error(`Preview failed (${res.status})`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Preview failed');
          setSrc(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (!assetId) {
    return <p className="muted">Upload an image to preview.</p>;
  }
  if (error) {
    return <p className="form-error">{error}</p>;
  }
  if (!src) {
    return <p className="muted">Loading preview…</p>;
  }
  return <img src={src} alt={alt || 'Uploaded asset'} className={className ?? 'asset-preview'} />;
}
