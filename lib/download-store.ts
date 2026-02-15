import { rmSync, existsSync } from 'fs';

/**
 * In-memory store for completed downloads.
 *
 * ## Why an in-memory Map?
 * After yt-dlp finishes downloading a video, the file lives in a temp directory.
 * We need a way to pass a reference (a download ID) from the SSE progress endpoint
 * to the file-serving endpoint. A module-level Map works perfectly for this because:
 *   - Both API routes run in the same Node process (Next.js dev/production server)
 *   - Downloads are short-lived (consumed within seconds)
 *   - Auto-cleanup with TTL prevents memory/disk leaks
 *
 * ## Limitations
 * This won't work in a serverless environment where each request may run in a
 * separate process. For production at scale, you'd use Redis or a database.
 * For a personal YouTube downloader running on a single machine, this is ideal.
 */

interface DownloadEntry {
  /** Absolute path to the downloaded video file */
  filePath: string;
  /** Sanitized filename for the Content-Disposition header */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Temp directory to clean up when done */
  tempDir: string;
  /** Timestamp for TTL calculation */
  createdAt: number;
}

const store = new Map<string, DownloadEntry>();

/** Auto-cleanup downloads after 5 minutes to prevent disk leaks */
const CLEANUP_TTL_MS = 5 * 60 * 1000;

/**
 * Safely removes a temp directory and its contents.
 * Uses try/catch because the directory may already be gone.
 */
function cleanupTempDir(dir: string): void {
  try {
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log('[DOWNLOAD-STORE] Cleaned up temp dir:', dir);
    }
  } catch (error) {
    console.error('[DOWNLOAD-STORE] Cleanup failed:', error);
  }
}

/**
 * Store a completed download for later retrieval.
 * Automatically schedules cleanup after TTL expires.
 */
export function storeDownload(id: string, entry: DownloadEntry): void {
  store.set(id, entry);

  // Schedule auto-cleanup — if the user never fetches the file,
  // this prevents temp files from piling up on disk.
  setTimeout(() => {
    const existing = store.get(id);
    if (existing) {
      console.log('[DOWNLOAD-STORE] TTL expired, cleaning up:', id);
      cleanupTempDir(existing.tempDir);
      store.delete(id);
    }
  }, CLEANUP_TTL_MS);
}

/**
 * Retrieve a download entry by ID.
 * Returns undefined if the ID doesn't exist or has expired.
 */
export function getDownload(id: string): DownloadEntry | undefined {
  return store.get(id);
}

/**
 * Remove a download entry and clean up its temp directory.
 * Called after the file has been served to the client.
 */
export function removeDownload(id: string): void {
  const entry = store.get(id);
  if (entry) {
    cleanupTempDir(entry.tempDir);
    store.delete(id);
  }
}
