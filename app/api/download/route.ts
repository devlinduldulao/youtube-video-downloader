import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { createReadStream, statSync, existsSync, readdirSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Helper to clean up temp directory
function cleanupTempDir(dir: string) {
  try {
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log('[DOWNLOAD] Temp directory cleaned up:', dir);
    }
  } catch (error) {
    console.error('[DOWNLOAD] Failed to clean up temp dir:', error);
  }
}

/**
 * Path to yt-dlp executable.
 * Set via YT_DLP_PATH environment variable or defaults to 'yt-dlp' (assumes it's in PATH).
 * 
 * Installation:
 * - Windows: winget install yt-dlp
 * - macOS: brew install yt-dlp
 * - Linux: sudo apt install yt-dlp (or pip install yt-dlp)
 */
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

/**
 * Path to FFmpeg binary directory (required for merging video+audio streams).
 * Set via FFMPEG_PATH environment variable or defaults to 'ffmpeg' (assumes it's in PATH).
 * 
 * Installation:
 * - Windows: winget install ffmpeg
 * - macOS: brew install ffmpeg
 * - Linux: sudo apt install ffmpeg
 *
 * Falls back to @ffmpeg-installer/ffmpeg, which ships a pre-built binary for
 * macOS (x64 + arm64), Windows, and Linux — no manual install needed.
 */
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegInstaller.path;

// Route segment config - extend timeout for longer videos (1+ hour)
export const maxDuration = 3600; // 60 minutes max execution time
export const dynamic = 'force-dynamic';

// YouTube URL validation regex
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/;

function validateYouTubeURL(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

// Get video title using yt-dlp
async function getVideoTitle(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_PATH, ['--get-title', '--no-warnings', '--no-check-certificates', '--no-playlist', url]);
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
        // --get-title may output multiple titles with playlist URLs;
        // take only the first line to avoid concatenated titles.
        const firstTitle = title.trim().split('\n')[0];
        resolve(firstTitle.replace(/[^\w\s-]/g, '') || 'video');
      } else {
        reject(new Error(error || 'Failed to get video title'));
      }
    });
  });
}

// Download video using yt-dlp
async function downloadWithYtDlp(url: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[DOWNLOAD] Starting yt-dlp download...');
    console.log('[DOWNLOAD] Output directory:', outputDir);
    
    const outputTemplate = join(outputDir, 'video.%(ext)s');
    
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist', // Prevent processing entire playlist when URL has a &list= param
      '--progress',
    ];

    // Only add --ffmpeg-location if explicitly set (otherwise yt-dlp uses system PATH)
    if (FFMPEG_PATH) {
      args.push('--ffmpeg-location', FFMPEG_PATH);
    }

    args.push(url);

    const proc = spawn(YT_DLP_PATH, args);

    proc.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log('[DOWNLOAD]', output);
      }
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log('[DOWNLOAD] yt-dlp:', output);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[DOWNLOAD] yt-dlp process complete');
        
        // Find the downloaded file
        const files = readdirSync(outputDir);
        console.log('[DOWNLOAD] Files in output dir:', files);
        
        const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'));
        if (videoFile) {
          const fullPath = join(outputDir, videoFile);
          console.log('[DOWNLOAD] Found video file:', fullPath);
          resolve(fullPath);
        } else {
          reject(new Error('No video file found after download'));
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });
  });
}

export async function POST(request: NextRequest) {
  let tempDir = '';
  let outputPath = '';
  
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL_REQUIRED' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!validateYouTubeURL(url)) {
      return NextResponse.json(
        { error: 'INVALID_URL' },
        { status: 400 }
      );
    }

    console.log('[DOWNLOAD] Starting download for:', url);

    // Get video title
    const title = await getVideoTitle(url);
    console.log('[DOWNLOAD] Video title:', title);

    // Create unique temp directory for this download
    tempDir = join(tmpdir(), `yt-download-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    console.log('[DOWNLOAD] Created temp dir:', tempDir);

    // Download with yt-dlp - returns the actual file path
    outputPath = await downloadWithYtDlp(url, tempDir);

    // Verify file exists
    if (!existsSync(outputPath)) {
      throw new Error('Download completed but file not found');
    }

    // Get file size
    const fileStats = statSync(outputPath);
    const fileSize = fileStats.size;
    console.log(`[DOWNLOAD] Final file size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    // Create read stream
    const fileStream = createReadStream(outputPath);

    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Length', fileSize.toString());

    // Convert Node.js stream to Web ReadableStream
    // Capture tempDir for cleanup in closures
    const cleanupDir = tempDir;
    
    const webStream = new ReadableStream({
      async start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        fileStream.on('end', () => {
          console.log('[DOWNLOAD] Stream completed, cleaning up...');
          controller.close();
          cleanupTempDir(cleanupDir);
        });

        fileStream.on('error', (error) => {
          console.error('[DOWNLOAD] Stream error:', error);
          controller.error(error);
          cleanupTempDir(cleanupDir);
        });
      },
      cancel() {
        console.log('[DOWNLOAD] Stream cancelled, cleaning up...');
        fileStream.destroy();
        cleanupTempDir(cleanupDir);
      }
    });

    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('[DOWNLOAD] Fatal error:', error);
    console.error('[DOWNLOAD] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    });

    // Clean up on error
    cleanupTempDir(tempDir);
    
    return NextResponse.json(
      { 
        error: 'DOWNLOAD_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
