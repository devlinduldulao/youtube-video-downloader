import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

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
    
    // Get formats with both video and audio
    const formats = info.formats.filter(format => format.hasVideo && format.hasAudio);
    
    // Prioritize 1080p, then 720p, then highest available
    const preferredQualities = ['1080p', '720p'];
    let selectedFormat = formats.find(format => 
      preferredQualities.some(quality => format.qualityLabel?.includes(quality))
    );
    
    // If no preferred quality found, select highest quality format
    if (!selectedFormat) {
      selectedFormat = formats.sort((a, b) => {
        const heightA = a.height || 0;
        const heightB = b.height || 0;
        return heightB - heightA;
      })[0];
    }
    
    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);
    headers.set('Content-Type', 'video/mp4');

    // Create stream with selected quality
    const videoStream = ytdl(url, {
      format: selectedFormat,
    });

    // Convert stream to Response
    const stream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        videoStream.on('end', () => {
          controller.close();
        });

        videoStream.on('error', (error) => {
          console.error('Stream error:', error);
          controller.error(error);
        });
      },
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download video. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}
