import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL_REQUIRED' },
        { status: 400 }
      );
    }

    // Basic YouTube URL validation
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return NextResponse.json(
        { error: 'INVALID_SOURCE_URL' },
        { status: 400 }
      );
    }

    // Use yt-dlp to get video info (works better on Vercel)
    const info: any = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: false,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      ]
    });

    // Extract best quality from formats
    const formats = info.formats || [];
    const videoFormats = formats.filter((f: any) => f.vcodec !== 'none' && f.acodec === 'none');
    const bestVideo = videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0))[0];
    const quality = bestVideo?.format_note || bestVideo?.height ? `${bestVideo.height}p` : 'HD';

    return NextResponse.json({
      videoId: info.id,
      title: info.title,
      author: info.uploader || info.channel,
      thumbnail: info.thumbnail,
      quality: quality,
      lengthSeconds: String(Math.floor(info.duration || 0)),
      viewCount: String(info.view_count || 0),
    });

  } catch (error) {
    console.error('Info fetch error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
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
