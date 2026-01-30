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
    
    // Get highest quality format for display
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestvideo',
      filter: 'videoandaudio' 
    });

    const thumbnails = videoDetails.thumbnails;
    // Get best thumbnail
    const thumbnail = thumbnails[thumbnails.length - 1].url;

    return NextResponse.json({
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      author: videoDetails.author.name,
      thumbnail: thumbnail,
      quality: format.qualityLabel || 'HD',
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
