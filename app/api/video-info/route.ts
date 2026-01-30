import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import { getYtdlOptions } from '@/lib/ytdl-config';

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

    const info = await ytdl.getInfo(url, getYtdlOptions());
    const videoDetails = info.videoDetails;
    
    // Get best video-only format (same logic as download route)
    const videoFormats = info.formats.filter(
      format => format.hasVideo && !format.hasAudio
    );
    const selectedFormat = videoFormats.sort((a, b) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      return heightB - heightA;
    })[0];

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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    // Return more specific error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'TARGET_UNREACHABLE',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
