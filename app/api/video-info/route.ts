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

    console.log('[VIDEO-INFO] Fetching info for:', url);

    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    
    console.log('[VIDEO-INFO] Total formats available:', info.formats.length);

    // Get best video-only format (same logic as download route)
    const videoFormats = info.formats.filter(
      format => format.hasVideo && !format.hasAudio
    );
    const selectedFormat = videoFormats.sort((a, b) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      return heightB - heightA;
    })[0];

    console.log('[VIDEO-INFO] Video-only formats available:', videoFormats.length);
    
    // Log available qualities
    const availableQualities = videoFormats
      .map(f => f.qualityLabel)
      .filter(Boolean)
      .sort();
    console.log('[VIDEO-INFO] Available qualities:', availableQualities);

    if (!selectedFormat) {
      console.error('[VIDEO-INFO] No suitable video format found');
    } else {
      console.log('[VIDEO-INFO] Selected format:', {
        quality: selectedFormat.qualityLabel,
        height: selectedFormat.height,
        container: selectedFormat.container,
      });
    }

    const thumbnails = videoDetails.thumbnails;
    const thumbnail = thumbnails[thumbnails.length - 1].url;

    return NextResponse.json({
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      author: videoDetails.author.name,
      thumbnail: thumbnail,
      quality: selectedFormat?.qualityLabel || 'SD',
      lengthSeconds: videoDetails.lengthSeconds,
      viewCount: videoDetails.viewCount,
    });

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
