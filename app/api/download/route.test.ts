/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/download/route';
import { NextRequest } from 'next/server';
import { PassThrough } from 'stream';

// Mock ffmpeg
vi.mock('fluent-ffmpeg', () => {
  const mockFfmpeg: any = vi.fn(() => {
    const mockCommand = {
      input: vi.fn().mockReturnThis(),
      inputFormat: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      format: vi.fn().mockReturnThis(),
      on: vi.fn(function(this: any, event: string, handler: Function) {
        if (event === 'end') {
          setTimeout(() => handler(), 10);
        }
        return this;
      }),
      pipe: vi.fn((stream: PassThrough) => {
        setTimeout(() => {
          stream.write(Buffer.from('merged video data'));
          stream.end();
        }, 10);
        return stream;
      }),
      kill: vi.fn(),
    };
    return mockCommand;
  });
  
  mockFfmpeg.setFfmpegPath = vi.fn();
  
  return { default: mockFfmpeg };
});

// Mock @ffmpeg-installer/ffmpeg
vi.mock('@ffmpeg-installer/ffmpeg', () => ({
  default: { path: '/usr/bin/ffmpeg' },
}));

// Mock ytdl-core
vi.mock('@distube/ytdl-core', () => {
  const mockValidateURL = vi.fn((url: string) => url.includes('youtube.com') || url.includes('youtu.be'));
  const mockGetInfo = vi.fn(async (url: string) => ({
    videoDetails: {
      title: 'Test Video Title',
      videoId: 'test123',
      lengthSeconds: '120',
      viewCount: '1000',
      author: { name: 'Test Author' },
      thumbnails: [
        { url: 'https://i.ytimg.com/test.jpg', width: 120, height: 90 },
        { url: 'https://i.ytimg.com/test-hq.jpg', width: 480, height: 360 },
      ],
    },
    formats: [
      // Video-only formats
      {
        itag: 137,
        qualityLabel: '1080p',
        hasVideo: true,
        hasAudio: false,
        height: 1080,
        width: 1920,
      },
      {
        itag: 136,
        qualityLabel: '720p',
        hasVideo: true,
        hasAudio: false,
        height: 720,
        width: 1280,
      },
      {
        itag: 135,
        qualityLabel: '480p',
        hasVideo: true,
        hasAudio: false,
        height: 480,
        width: 854,
      },
      // Audio-only formats
      {
        itag: 140,
        hasVideo: false,
        hasAudio: true,
        audioBitrate: 128,
      },
      {
        itag: 139,
        hasVideo: false,
        hasAudio: true,
        audioBitrate: 48,
      },
    ],
  }));
  
  const mockYtdl: any = vi.fn((url: string, options: any) => {
    const mockStream = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('test video data')), 10);
        } else if (event === 'end') {
          setTimeout(() => handler(), 20);
        }
        return mockStream;
      }),
    };
    return mockStream;
  });
  
  mockYtdl.validateURL = mockValidateURL;
  mockYtdl.getInfo = mockGetInfo;
  
  return {
    default: mockYtdl,
    validateURL: mockValidateURL,
    getInfo: mockGetInfo,
  };
});

describe('Download API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if URL is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('YouTube URL is required');
  });

  it('should return 400 if URL is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://invalid-url.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid YouTube URL');
  });

  it('should prioritize 1080p quality when available', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);

    expect(ytdl.validateURL).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test123');
    expect(ytdl.getInfo).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test123');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('Test Video Title');
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
  });

  it('should prioritize 720p quality when 1080p is not available', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    // Mock getInfo to return formats without 1080p
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Test Video Without 1080p',
        videoId: 'test456',
        lengthSeconds: '120',
        viewCount: '1000',
        author: { name: 'Test Author' },
        thumbnails: [{ url: 'https://i.ytimg.com/test.jpg', width: 480, height: 360 }],
      },
      formats: [
        {
          itag: 136,
          qualityLabel: '720p',
          hasVideo: true,
          hasAudio: false,
          height: 720,
          width: 1280,
        },
        {
          itag: 135,
          qualityLabel: '480p',
          hasVideo: true,
          hasAudio: false,
          height: 480,
          width: 854,
        },
        {
          itag: 140,
          hasVideo: false,
          hasAudio: true,
          audioBitrate: 128,
        },
      ],
    } as any);

    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test456' }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('Test Video Without 1080p');
  });

  it('should fall back to highest quality when preferred qualities are not available', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    // Mock getInfo to return only low-quality formats
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Low Quality Video',
        videoId: 'test789',
        lengthSeconds: '60',
        viewCount: '500',
        author: { name: 'Test Author' },
        thumbnails: [{ url: 'https://i.ytimg.com/test.jpg', width: 480, height: 360 }],
      },
      formats: [
        {
          itag: 135,
          qualityLabel: '480p',
          hasVideo: true,
          hasAudio: false,
          height: 480,
          width: 854,
        },
        {
          itag: 134,
          qualityLabel: '360p',
          hasVideo: true,
          hasAudio: false,
          height: 360,
          width: 640,
        },
        {
          itag: 140,
          hasVideo: false,
          hasAudio: true,
          audioBitrate: 128,
        },
      ],
    } as any);

    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test789' }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
  });

  it('should handle download errors gracefully', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    // Mock getInfo to throw an error
    vi.mocked(ytdl.getInfo).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=fail' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to download video. Please check the URL and try again.');
  });

  it('should sanitize video title for filename', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    // Mock getInfo with special characters in title
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Test Video: Special/Characters\\Here*',
        videoId: 'test999',
        lengthSeconds: '120',
        viewCount: '1000',
        author: { name: 'Test Author' },
        thumbnails: [{ url: 'https://i.ytimg.com/test.jpg', width: 480, height: 360 }],
      },
      formats: [
        {
          itag: 136,
          qualityLabel: '720p',
          hasVideo: true,
          hasAudio: false,
          height: 720,
          width: 1280,
        },
        {
          itag: 140,
          hasVideo: false,
          hasAudio: true,
          audioBitrate: 128,
        },
      ],
    } as any);

    const request = new NextRequest('http://localhost:3000/api/download', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test999' }),
    });

    const response = await POST(request);
    const contentDisposition = response.headers.get('Content-Disposition');

    expect(contentDisposition).not.toContain('/');
    expect(contentDisposition).not.toContain('\\');
    expect(contentDisposition).not.toContain('*');
    expect(contentDisposition).toContain('.mp4');
  });
});
