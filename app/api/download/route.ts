import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Basic YouTube URL validation
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Get video info first to get title
    const info: any = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
    });
    
    const title = (info.title || 'video').replace(/[^\w\s-]/g, '');

    // Download video using youtube-dl-exec with output to stdout
    // This returns a readable stream of the video data
    const videoBuffer = await youtubedl(url, {
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      output: '-',  // Output to stdout
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ],
    });

    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);
    headers.set('Content-Type', 'video/mp4');

    // Return the buffer as response
    return new NextResponse(videoBuffer as any, { headers });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download video. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}
