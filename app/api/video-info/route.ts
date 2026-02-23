import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// Route segment config
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Path to yt-dlp executable.
 * Set via YT_DLP_PATH environment variable or defaults to 'yt-dlp' (assumes it's in PATH).
 */
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

// YouTube URL validation regex
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/;

function validateYouTubeURL(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  quality: string;
  lengthSeconds: string;
  viewCount: string;
}

// Get video info using yt-dlp
async function getVideoInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    // Named 'proc' to avoid shadowing Node's global `process` object
    const proc = spawn(YT_DLP_PATH, [
      '--dump-json',
      '--no-warnings',
      '--no-download',
      '--no-check-certificates',
      url
    ]);

    let jsonOutput = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      jsonOutput += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(jsonOutput);
          
          // Find best video quality available
          const formats = info.formats || [];
          const videoFormats = formats.filter((f: { vcodec?: string; acodec?: string; height?: number }) => 
            f.vcodec !== 'none' && f.acodec === 'none'
          );
          const bestFormat = videoFormats.sort((a: { height?: number }, b: { height?: number }) => 
            (b.height || 0) - (a.height || 0)
          )[0];
          
          resolve({
            videoId: info.id,
            title: info.title,
            author: info.uploader || info.channel || 'Unknown',
            thumbnail: info.thumbnail,
            quality: bestFormat?.height ? `${bestFormat.height}p` : bestFormat?.format_note || 'HD',
            lengthSeconds: String(info.duration || 0),
            viewCount: String(info.view_count || 0),
          });
        } catch {
          reject(new Error('Failed to parse video info'));
        }
      } else {
        reject(new Error(error || 'Failed to get video info'));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL_REQUIRED' },
        { status: 400 }
      );
    }

    if (!validateYouTubeURL(url)) {
      return NextResponse.json(
        { error: 'INVALID_SOURCE_URL' },
        { status: 400 }
      );
    }

    console.log('[VIDEO-INFO] Fetching info for:', url);

    const videoInfo = await getVideoInfo(url);
    
    console.log('[VIDEO-INFO] Video info retrieved:', {
      title: videoInfo.title,
      quality: videoInfo.quality,
      duration: videoInfo.lengthSeconds,
    });

    return NextResponse.json(videoInfo);

  } catch (error) {
    console.error('[VIDEO-INFO] Error:', error);
    console.error('[VIDEO-INFO] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      { 
        error: 'TARGET_UNREACHABLE',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}
