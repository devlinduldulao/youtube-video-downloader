/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/video-info/route';
import { NextRequest } from 'next/server';

// Mock ytdl-core
vi.mock('@distube/ytdl-core', () => {
  const mockValidateURL = vi.fn((url: string) => url.includes('youtube.com') || url.includes('youtu.be'));
  const mockGetInfo = vi.fn(async (url: string) => ({
    videoDetails: {
      title: 'Test Video Title',
      videoId: 'test123',
      lengthSeconds: '180',
      viewCount: '5000',
      author: { name: 'Test Creator' },
      thumbnails: [
        { url: 'https://i.ytimg.com/vi/test123/default.jpg', width: 120, height: 90 },
        { url: 'https://i.ytimg.com/vi/test123/hqdefault.jpg', width: 480, height: 360 },
        { url: 'https://i.ytimg.com/vi/test123/maxresdefault.jpg', width: 1280, height: 720 },
      ],
    },
    formats: [
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
      {
        itag: 140,
        hasVideo: false,
        hasAudio: true,
        audioBitrate: 128,
      },
    ],
  }));
  
  const mockYtdl: any = vi.fn();
  mockYtdl.validateURL = mockValidateURL;
  mockYtdl.getInfo = mockGetInfo;
  
  return {
    default: mockYtdl,
    validateURL: mockValidateURL,
    getInfo: mockGetInfo,
  };
});

describe('Video Info API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if URL is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URL_REQUIRED');
  });

  it('should return 400 if URL is invalid', async () => {
    const ytdl = await import('@distube/ytdl-core');
    // Mock validateURL to return false for this specific test
    vi.mocked(ytdl.default.validateURL).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://not-youtube.com/video' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_SOURCE_URL');
  });

  it('should return video info for valid URL', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      videoId: 'test123',
      title: 'Test Video Title',
      author: 'Test Creator',
      lengthSeconds: '180',
      viewCount: '5000',
    });
    expect(data.thumbnail).toContain('maxresdefault.jpg');
    expect(ytdl.validateURL).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test123');
    expect(ytdl.getInfo).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=test123',
      expect.objectContaining({
        requestOptions: expect.objectContaining({
          headers: expect.any(Object)
        })
      })
    );
  });

  it('should return highest thumbnail quality', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.thumbnail).toBe('https://i.ytimg.com/vi/test123/maxresdefault.jpg');
  });

  it('should prioritize highest video quality', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return the highest available quality (1080p in our mock)
    expect(data.quality).toBe('1080p');
  });

  it('should prioritize 720p when 1080p is not available', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Test Video 720p',
        videoId: 'test456',
        lengthSeconds: '120',
        viewCount: '2000',
        author: { name: 'Test Author' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/test456/hqdefault.jpg', width: 480, height: 360 },
        ],
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

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test456' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.quality).toBe('720p');
  });

  it('should fall back to highest quality when preferred qualities not available', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Test Low Quality Video',
        videoId: 'test789',
        lengthSeconds: '60',
        viewCount: '100',
        author: { name: 'Test Author' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/test789/default.jpg', width: 120, height: 90 },
        ],
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

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test789' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.quality).toBe('480p'); // Highest available
  });

  it('should handle errors gracefully', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    vi.mocked(ytdl.getInfo).mockRejectedValueOnce(new Error('Video unavailable'));

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=error' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('TARGET_UNREACHABLE');
  });

  it('should handle short-form YouTube URLs', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtu.be/test123' }),
    });

    const response = await POST(request);

    expect(ytdl.validateURL).toHaveBeenCalledWith('https://youtu.be/test123');
    expect(response.status).toBe(200);
  });

  it('should default to HD when quality label is missing', async () => {
    const ytdl = await import('@distube/ytdl-core');
    
    vi.mocked(ytdl.getInfo).mockResolvedValueOnce({
      videoDetails: {
        title: 'Test Video No Quality',
        videoId: 'test000',
        lengthSeconds: '90',
        viewCount: '300',
        author: { name: 'Test Author' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/test000/default.jpg', width: 120, height: 90 },
        ],
      },
      formats: [
        {
          itag: 134,
          qualityLabel: undefined,
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

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test000' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.quality).toBe('HD');
  });
});
