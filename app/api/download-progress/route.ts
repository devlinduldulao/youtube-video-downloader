import { NextRequest } from 'next/server';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { storeDownload } from '@/lib/download-store';

/**
 * SSE (Server-Sent Events) endpoint for tracking YouTube download progress.
 *
 * ## How it works
 * 1. Client sends a POST with { url } in the body
 * 2. Server responds with a `text/event-stream` (SSE) stream
 * 3. yt-dlp is spawned with `--newline` flag, which outputs each progress
 *    update on a separate line instead of overwriting with \r
 * 4. We parse these lines with regex and send progress events to the client
 * 5. When download completes, we store the file info and send a "complete" event
 *    with a download ID the client can use to fetch the file
 *
 * ## SSE Event Types
 * - `progress`: { phase, percent, overallPercent, speed, eta, totalSize, message }
 * - `complete`: { downloadId, filename, fileSize, fileSizeMB }
 * - `error`:    { message }
 *
 * ## Why SSE instead of WebSockets?
 * SSE is simpler, works over HTTP (no upgrade needed), and is perfect for
 * server-to-client streaming. We don't need bidirectional communication —
 * the client just listens for progress updates.
 *
 * ## Overall Progress Calculation
 * yt-dlp may download video and audio as separate streams, then merge them.
 * We map these phases to an overall percentage:
 *   - Video download:  0% – 75%
 *   - Audio download: 75% – 90%
 *   - Merging:        90% – 98%
 *   - Complete:       100%
 * If it's a single combined stream (no merge needed), we map 0-100% → 0-95%.
 */

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '';

// Allow up to 60 minutes for very long videos
export const maxDuration = 3600;
export const dynamic = 'force-dynamic';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/;

function validateYouTubeURL(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

/**
 * Parse a yt-dlp progress line into structured data.
 *
 * Example lines:
 *   "[download]  45.2% of  124.56MiB at  2.95MiB/s ETA 00:18"
 *   "[download] 100% of   54.24MiB in 00:41"
 *   "[download]   0.0% of ~ 124.56MiB at Unknown B/s ETA Unknown"
 */
function parseProgressLine(line: string): {
  percent: number;
  totalSize: string | null;
  speed: string | null;
  eta: string | null;
} | null {
  // Match: [download]  XX.X% of [~] XX.XXMiB
  const progressMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*\w+)/
  );
  if (!progressMatch) return null;

  const percent = parseFloat(progressMatch[1]);
  const totalSize = progressMatch[2].trim();

  // Speed and ETA are optional (not present on the final "100% ... in XX:XX" line)
  const speedMatch = line.match(/at\s+([\d.]+\s*\w+\/s)/);
  const etaMatch = line.match(/ETA\s+(\S+)/);

  return {
    percent,
    totalSize,
    speed: speedMatch ? speedMatch[1] : null,
    eta: etaMatch ? etaMatch[1] : null,
  };
}

/**
 * Get video title using yt-dlp --get-title.
 * Separated into its own function for clarity and reuse.
 */
function getVideoTitle(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_PATH, [
      '--get-title',
      '--no-warnings',
      '--no-check-certificates',
      url,
    ]);

    let title = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      title += data.toString();
    });
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(title.trim().replace(/[^\w\s-]/g, '') || 'video');
      } else {
        reject(new Error(error || 'Failed to get video title'));
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  let ytDlpProcess: ChildProcess | null = null;

  /**
   * Helper to send an SSE event through the stream controller.
   *
   * SSE format:
   *   event: <type>\n
   *   data: <json>\n
   *   \n
   *
   * The double newline signals the end of an event to the browser.
   */
  function sendSSE(
    controller: ReadableStreamDefaultController,
    event: string,
    data: object,
  ): void {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(payload));
    } catch {
      // Stream may already be closed if client disconnected
    }
  }

  try {
    const { url } = await request.json();

    if (!url) {
      return Response.json({ error: 'URL_REQUIRED' }, { status: 400 });
    }

    if (!validateYouTubeURL(url)) {
      return Response.json({ error: 'INVALID_URL' }, { status: 400 });
    }

    // Kill yt-dlp if the client aborts the request (navigates away, etc.)
    request.signal.addEventListener('abort', () => {
      if (ytDlpProcess) {
        console.log('[DOWNLOAD-PROGRESS] Client aborted, killing yt-dlp');
        ytDlpProcess.kill('SIGTERM');
        ytDlpProcess = null;
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        /**
         * Track how many "[download] Destination:" lines we've seen.
         * - 1st = video stream
         * - 2nd = audio stream (separate codec)
         * Some videos come as a single combined stream (only 1 destination).
         */
        let downloadCount = 0;
        let currentPhase: 'downloading_video' | 'downloading_audio' | 'merging' =
          'downloading_video';

        try {
          // ── Phase 1: Fetch metadata ──────────────────────────────────
          sendSSE(controller, 'progress', {
            phase: 'initializing',
            percent: 0,
            overallPercent: 0,
            speed: null,
            eta: null,
            totalSize: null,
            message: 'FETCHING_METADATA...',
          });

          const title = await getVideoTitle(url);
          console.log('[DOWNLOAD-PROGRESS] Title:', title);

          // Create isolated temp directory for this download
          const tempDir = join(tmpdir(), `yt-download-${Date.now()}`);
          mkdirSync(tempDir, { recursive: true });
          const outputTemplate = join(tempDir, 'video.%(ext)s');

          sendSSE(controller, 'progress', {
            phase: 'downloading_video',
            percent: 0,
            overallPercent: 0,
            speed: null,
            eta: null,
            totalSize: null,
            message: `TARGET_LOCKED: ${title}`,
          });

          // ── Phase 2: Download with progress tracking ─────────────────
          const outputPath = await new Promise<string>((resolve, reject) => {
            const args = [
              '-f',
              'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
              '--merge-output-format',
              'mp4',
              '-o',
              outputTemplate,
              '--no-warnings',
              '--no-check-certificates',
              '--progress',
              '--newline', // KEY: outputs progress on separate lines for parsing
            ];

            // Only add --ffmpeg-location if explicitly set
            if (FFMPEG_PATH) {
              args.push('--ffmpeg-location', FFMPEG_PATH);
            }

            args.push(url);

            ytDlpProcess = spawn(YT_DLP_PATH, args);

            /**
             * Handle output from yt-dlp (both stdout and stderr).
             * yt-dlp may send progress to either stream depending on the
             * environment, so we parse both identically.
             */
            const handleOutput = (data: Buffer) => {
              const lines = data.toString().split('\n');

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Detect a new download stream starting
                if (trimmed.includes('[download] Destination:')) {
                  downloadCount++;
                  if (downloadCount >= 2) {
                    currentPhase = 'downloading_audio';
                  }
                }

                // Detect merging phase
                if (
                  trimmed.includes('[Merger]') ||
                  trimmed.includes('[ExtractAudio]')
                ) {
                  currentPhase = 'merging';
                  sendSSE(controller, 'progress', {
                    phase: 'merging',
                    percent: 100,
                    overallPercent: 95,
                    speed: null,
                    eta: null,
                    totalSize: null,
                    message: 'MERGING_STREAMS...',
                  });
                  continue;
                }

                // Parse download progress
                const progress = parseProgressLine(trimmed);
                if (progress) {
                  // Map phase-specific percentage to overall progress
                  let overallPercent: number;
                  if (currentPhase === 'downloading_video') {
                    // Video is the bulk of the download: 0% → 75%
                    overallPercent = Math.round(progress.percent * 0.75);
                  } else if (currentPhase === 'downloading_audio') {
                    // Audio is typically much smaller: 75% → 90%
                    overallPercent = Math.round(
                      75 + progress.percent * 0.15,
                    );
                  } else {
                    overallPercent = 95;
                  }

                  sendSSE(controller, 'progress', {
                    phase: currentPhase,
                    percent: Math.round(progress.percent * 10) / 10,
                    overallPercent: Math.min(overallPercent, 99),
                    speed: progress.speed,
                    eta: progress.eta,
                    totalSize: progress.totalSize,
                    message:
                      currentPhase === 'downloading_audio'
                        ? 'EXTRACTING_AUDIO_STREAM...'
                        : 'EXTRACTING_VIDEO_STREAM...',
                  });
                }
              }
            };

            ytDlpProcess.stdout?.on('data', handleOutput);
            ytDlpProcess.stderr?.on('data', handleOutput);

            ytDlpProcess.on('close', (code) => {
              ytDlpProcess = null;

              if (code === 0) {
                // Find the output file
                const files = readdirSync(tempDir);
                const videoFile = files.find(
                  (f) =>
                    f.endsWith('.mp4') ||
                    f.endsWith('.mkv') ||
                    f.endsWith('.webm'),
                );

                if (videoFile) {
                  resolve(join(tempDir, videoFile));
                } else {
                  reject(new Error('No video file found after download'));
                }
              } else {
                reject(new Error(`yt-dlp exited with code ${code}`));
              }
            });

            ytDlpProcess.on('error', (err) => {
              ytDlpProcess = null;
              reject(err);
            });
          });

          // ── Phase 3: Finalize ────────────────────────────────────────
          if (!existsSync(outputPath)) {
            throw new Error('Download completed but file not found');
          }

          const fileStats = statSync(outputPath);
          const fileSize = fileStats.size;
          const filename = `${title}.mp4`;

          // Generate a unique ID for the client to fetch the file
          const downloadId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

          // Store the file info for the /api/download-file endpoint
          storeDownload(downloadId, {
            filePath: outputPath,
            filename,
            fileSize,
            tempDir,
            createdAt: Date.now(),
          });

          // Send 100% before complete for smooth UI transition
          sendSSE(controller, 'progress', {
            phase: 'downloading_video',
            percent: 100,
            overallPercent: 100,
            speed: null,
            eta: null,
            totalSize: null,
            message: 'EXTRACTION_COMPLETE',
          });

          sendSSE(controller, 'complete', {
            downloadId,
            filename,
            fileSize,
            fileSizeMB: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
          });

          console.log(
            `[DOWNLOAD-PROGRESS] Complete: ${filename} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`,
          );
        } catch (error) {
          console.error('[DOWNLOAD-PROGRESS] Error:', error);
          sendSSE(controller, 'error', {
            message:
              error instanceof Error ? error.message : 'DOWNLOAD_FAILED',
          });
        } finally {
          controller.close();
        }
      },

      cancel() {
        // Client disconnected — kill yt-dlp to avoid orphaned processes
        if (ytDlpProcess) {
          console.log('[DOWNLOAD-PROGRESS] Stream cancelled, killing yt-dlp');
          ytDlpProcess.kill('SIGTERM');
          ytDlpProcess = null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering if behind nginx
      },
    });
  } catch (error) {
    console.error('[DOWNLOAD-PROGRESS] Fatal error:', error);
    return Response.json(
      {
        error: 'PROGRESS_STREAM_FAILED',
        details:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
