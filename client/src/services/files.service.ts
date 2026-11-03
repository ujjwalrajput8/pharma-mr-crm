import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type FilePurpose =
  | 'leave-proof'
  | 'selfie'
  | 'employee-doc'
  | 'expense-receipt'
  | 'avatar';

export interface StoredFileInfo {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
}

export const filesApi = {
  /** Uploads one file (≤5 MB; JPEG/PNG/WebP/PDF) and returns its stored key. */
  async upload(file: File, purpose: FilePurpose): Promise<StoredFileInfo> {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    const { data } = await api.post<ApiSuccess<StoredFileInfo>>('/files', form, {
      // Let the browser set the multipart boundary.
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};

/**
 * Downloads a stored file as a blob and returns an object URL. Files are
 * auth-protected, so a plain <a href> / <img src> to the API cannot work —
 * the request must carry the bearer token.
 */
export async function fetchFileBlobUrl(key: string): Promise<string> {
  const { data } = await api.get<Blob>(`/files/${key}`, { responseType: 'blob' });
  return URL.createObjectURL(data);
}

/** Opens a stored file in a new tab (blob URL, token-authenticated fetch). */
export async function openStoredFile(key: string): Promise<void> {
  const url = await fetchFileBlobUrl(key);
  window.open(url, '_blank', 'noopener');
}

/** `file:<key>` → key; anything else → null. */
export function fileKeyFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('file:') ? value.slice(5) : null;
}

/**
 * One download per file, shared by every component showing it (a list can
 * show the same person's avatar thirty times). The object URL is revoked when
 * the last user lets go of it.
 */
const blobCache = new Map<string, { promise: Promise<string>; users: number; url?: string }>();

function acquireBlobUrl(key: string): Promise<string> {
  let entry = blobCache.get(key);
  if (!entry) {
    const fresh: { promise: Promise<string>; users: number; url?: string } = {
      users: 0,
      promise: fetchFileBlobUrl(key).then((url) => {
        fresh.url = url;
        return url;
      }),
    };
    // A failed download is forgotten, so the next mount retries it.
    fresh.promise.catch(() => {
      if (blobCache.get(key) === fresh) blobCache.delete(key);
    });
    blobCache.set(key, fresh);
    entry = fresh;
  }
  entry.users += 1;
  return entry.promise;
}

function releaseBlobUrl(key: string): void {
  const entry = blobCache.get(key);
  if (!entry) return;
  entry.users -= 1;
  if (entry.users <= 0) {
    blobCache.delete(key);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
}

/**
 * Resolves a photoUrl-ish value for <img>: `file:<key>` becomes a blob object
 * URL (shared, revoked when no one uses it); ordinary URLs pass straight through.
 */
export function useStoredFileUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const key = fileKeyFromValue(value);
    if (!key) {
      setUrl(value ?? null);
      return;
    }

    let cancelled = false;
    acquireBlobUrl(key)
      .then((blobUrl) => {
        if (!cancelled) setUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      releaseBlobUrl(key);
    };
  }, [value]);

  return url;
}
