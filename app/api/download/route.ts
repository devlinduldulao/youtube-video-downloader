import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { PassThrough } from 'stream';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Get video info
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '');
    
    // Get best video-only format
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
      return NextResponse.json(
        { error: 'No suitable video/audio formats found' },
        { status: 500 }
      );
    }

    // Create video and audio streams
    const videoStream = ytdl(url, { format: videoFormat });
    const audioStream = ytdl(url, { format: audioFormat });

    // Create output stream for merged video
    const outputStream = new PassThrough();

    // Merge video and audio using ffmpeg
    const ffmpegProcess = ffmpeg()
      .input(videoStream)
      .inputFormat('mp4')
      .input(audioStream)
      .inputFormat('webm')
      .outputOptions([
        '-c:v copy',      // Copy video codec (no re-encoding)
        '-c:a aac',       // Convert audio to AAC
        '-movflags frag_keyframe+empty_moov' // Enable streaming
      ])
      .format('mp4')
      .on('error', (error) => {
        console.error('FFmpeg error:', error);
        outputStream.destroy(error);
      })
      .on('end', () => {
        console.log('FFmpeg processing finished');
      });

    // Pipe ffmpeg output to our output stream
    ffmpegProcess.pipe(outputStream, { end: true });

    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);
    headers.set('Content-Type', 'video/mp4');

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        outputStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        outputStream.on('end', () => {
          controller.close();
        });

        outputStream.on('error', (error) => {
          console.error('Stream error:', error);
          controller.error(error);
        });
      },
      cancel() {
        outputStream.destroy();
        ffmpegProcess.kill('SIGKILL');
      }
    });

    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download video. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}
