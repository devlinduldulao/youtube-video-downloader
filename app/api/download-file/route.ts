import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { getDownload, removeDownload } from '@/lib/download-store';

/**
 * File-serving endpoint for completed downloads.
 *
 * ## How it works
 * After the SSE progress endpoint (/api/download-progress) finishes
 * downloading a video, it stores the file info in an in-memory Map
 * with a unique download ID. The client receives this ID via the
 * "complete" SSE event and uses it to fetch the actual file here.
 *
 * ## Why a separate endpoint?
 * We can't mix SSE text events and binary file data in the same response.
 * Separating concerns also lets the browser use its native download manager
 * (with its own progress bar) for the file transfer.
 *
 * ## Security
 * Download IDs are random and short-lived (5-minute TTL). In a production
 * app, you'd add authentication and rate limiting. For a personal tool,
 * the randomized ID provides sufficient protection.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'MISSING_DOWNLOAD_ID' },
      { status: 400 },
    );
  }

  const entry = getDownload(id);

  if (!entry) {
    return NextResponse.json(
      { error: 'DOWNLOAD_NOT_FOUND_OR_EXPIRED' },
      { status: 404 },
    );
  }

  if (!existsSync(entry.filePath)) {
    removeDownload(id);
    return NextResponse.json(
      { error: 'FILE_NOT_FOUND' },
      { status: 404 },
    );
  }

  const fileStats = statSync(entry.filePath);
  const fileStream = createReadStream(entry.filePath);

  // Set headers so the browser treats this as a file download
  const headers = new Headers();
  headers.set(
    'Content-Disposition',
    `attachment; filename="${entry.filename}"`,
  );
  headers.set('Content-Type', 'video/mp4');
  headers.set('Content-Length', fileStats.size.toString());

  /**
   * Convert Node.js ReadStream to Web ReadableStream.
   * This is necessary because Next.js responses use the Web Streams API,
   * while fs.createReadStream returns a Node.js Readable stream.
   */
  const webStream = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });

      fileStream.on('end', () => {
        controller.close();
        // Clean up temp files after a short delay to ensure the stream
        // has been fully flushed to the client
        setTimeout(() => removeDownload(id), 10_000);
      });

      fileStream.on('error', (error) => {
        console.error('[DOWNLOAD-FILE] Stream error:', error);
        controller.error(error);
        removeDownload(id);
      });
    },
    cancel() {
      fileStream.destroy();
      // Don't remove yet — the user might retry the download
    },
  });

  return new NextResponse(webStream, { headers });
}
