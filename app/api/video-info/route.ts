import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL_REQUIRED' },
        { status: 400 }
      );
    }

    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: 'INVALID_SOURCE_URL' },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    
    // Get formats with both video and audio (same logic as download route)
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

    const thumbnails = videoDetails.thumbnails;
    // Get best thumbnail
    const thumbnail = thumbnails[thumbnails.length - 1].url;

    return NextResponse.json({
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      author: videoDetails.author.name,
      thumbnail: thumbnail,
      quality: selectedFormat?.qualityLabel || 'HD',
      lengthSeconds: videoDetails.lengthSeconds,
      viewCount: videoDetails.viewCount,
    });

  } catch (error) {
    console.error('Info fetch error:', error);
    return NextResponse.json(
      { error: 'TARGET_UNREACHABLE' },
      { status: 500 }
    );
  }
}
