import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { createWriteStream, createReadStream, unlink } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL_REQUIRED' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: 'INVALID_URL' },
        { status: 400 }
      );
    }

    console.log('[DOWNLOAD] Starting download for:', url);

    // Get video info
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '');
    
    console.log('[DOWNLOAD] Video title:', title);
    console.log('[DOWNLOAD] Total formats available:', info.formats.length);

    // Get best video-only format (for HD quality)
    const videoFormats = info.formats.filter(
      format => format.hasVideo && !format.hasAudio
    );
    const videoFormat = videoFormats.sort((a, b) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      return heightB - heightA;
    })[0];

    // Get best audio-only format
    const audioFormats = info.formats.filter(
      format => format.hasAudio && !format.hasVideo
    );
    const audioFormat = audioFormats.sort((a, b) => {
      const bitrateA = a.audioBitrate || 0;
      const bitrateB = b.audioBitrate || 0;
      return bitrateB - bitrateA;
    })[0];

    if (!videoFormat || !audioFormat) {
      console.error('[DOWNLOAD] Missing formats - video:', !!videoFormat, 'audio:', !!audioFormat);
      return NextResponse.json(
        { error: 'NO_SUITABLE_FORMAT' },
        { status: 500 }
      );
    }

    console.log('[DOWNLOAD] Selected video format:', {
      quality: videoFormat.qualityLabel,
      height: videoFormat.height,
      container: videoFormat.container,
      codec: videoFormat.codecs,
    });
    console.log('[DOWNLOAD] Selected audio format:', {
      bitrate: audioFormat.audioBitrate,
      container: audioFormat.container,
      codec: audioFormat.codecs,
    });

    // Create temporary file paths
    const tempDir = tmpdir();
    const videoPath = join(tempDir, `video-${Date.now()}.${videoFormat.container || 'mp4'}`);
    const audioPath = join(tempDir, `audio-${Date.now()}.${audioFormat.container || 'webm'}`);
    const outputPath = join(tempDir, `output-${Date.now()}.mp4`);

    console.log('[DOWNLOAD] Downloading video to temp file...');

    // Download video to temp file
    await new Promise<void>((resolve, reject) => {
      const videoStream = ytdl(url, { format: videoFormat });
      const videoFile = createWriteStream(videoPath);
      
      videoStream.pipe(videoFile);
      videoStream.on('error', reject);
      videoFile.on('error', reject);
      videoFile.on('finish', () => {
        console.log('[DOWNLOAD] Video download complete');
        resolve();
      });
    });

    console.log('[DOWNLOAD] Downloading audio to temp file...');

    // Download audio to temp file
    await new Promise<void>((resolve, reject) => {
      const audioStream = ytdl(url, { format: audioFormat });
      const audioFile = createWriteStream(audioPath);
      
      audioStream.pipe(audioFile);
      audioStream.on('error', reject);
      audioFile.on('error', reject);
      audioFile.on('finish', () => {
        console.log('[DOWNLOAD] Audio download complete');
        resolve();
      });
    });

    console.log('[DOWNLOAD] Starting FFmpeg merge...');

    // Merge video and audio using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',      // Copy video codec (no re-encoding)
          '-c:a aac',       // Convert audio to AAC
          '-movflags frag_keyframe+empty_moov' // Enable streaming
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('[DOWNLOAD] FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          console.log('[DOWNLOAD] Processing:', progress.percent?.toFixed(1) + '%');
        })
        .on('error', (error) => {
          console.error('[DOWNLOAD] FFmpeg error:', error);
          reject(error);
        })
        .on('end', () => {
          console.log('[DOWNLOAD] FFmpeg merge complete');
          resolve();
        })
        .run();
    });

    // Create read stream from merged file
    const fileStream = createReadStream(outputPath);

    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);
    headers.set('Content-Type', 'video/mp4');

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      async start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        fileStream.on('end', async () => {
          console.log('[DOWNLOAD] Stream completed, cleaning up temp files...');
          controller.close();
          
          // Clean up temp files
          try {
            await Promise.all([
              unlinkAsync(videoPath),
              unlinkAsync(audioPath),
              unlinkAsync(outputPath)
            ]);
            console.log('[DOWNLOAD] Temp files cleaned up');
          } catch (cleanupError) {
            console.error('[DOWNLOAD] Cleanup error:', cleanupError);
          }
        });

        fileStream.on('error', async (error) => {
          console.error('[DOWNLOAD] Stream error:', error);
          controller.error(error);
          
          // Clean up temp files on error
          try {
            await Promise.all([
              unlinkAsync(videoPath).catch(() => {}),
              unlinkAsync(audioPath).catch(() => {}),
              unlinkAsync(outputPath).catch(() => {})
            ]);
          } catch (cleanupError) {
            console.error('[DOWNLOAD] Cleanup error:', cleanupError);
          }
        });
      },
      async cancel() {
        console.log('[DOWNLOAD] Stream cancelled, cleaning up...');
        fileStream.destroy();
        
        // Clean up temp files
        try {
          await Promise.all([
            unlinkAsync(videoPath).catch(() => {}),
            unlinkAsync(audioPath).catch(() => {}),
            unlinkAsync(outputPath).catch(() => {})
          ]);
        } catch (cleanupError) {
          console.error('[DOWNLOAD] Cleanup error:', cleanupError);
        }
      }
    });

    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('[DOWNLOAD] Fatal error:', error);
    console.error('[DOWNLOAD] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: 'DOWNLOAD_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
