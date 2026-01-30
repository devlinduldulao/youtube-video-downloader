/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/video-info/route';
import { NextRequest } from 'next/server';

// Mock youtube-dl-exec - use vi.fn() directly in factory
vi.mock('youtube-dl-exec', () => ({
  default: vi.fn(),
}));

describe('Video Info API Route', () => {
  let mockYoutubedl: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked function after import
    const { default: youtubedl } = await import('youtube-dl-exec');
    mockYoutubedl = youtubedl;
    
    // Default mock implementation
    vi.mocked(mockYoutubedl).mockResolvedValue({
      id: 'test123',
      title: 'Test Video Title',
      uploader: 'Test Creator',
      channel: 'Test Channel',
      thumbnail: 'https://i.ytimg.com/vi/test123/maxresdefault.jpg',
      duration: 180,
      view_count: 5000,
      formats: [
        {
          format_id: '137',
          format_note: '1080p',
          vcodec: 'avc1',
          acodec: 'none',
          height: 1080,
          width: 1920,
        },
        {
          format_id: '136',
          format_note: '720p',
          vcodec: 'avc1',
          acodec: 'none',
          height: 720,
          width: 1280,
        },
        {
          format_id: '140',
          vcodec: 'none',
          acodec: 'mp4a',
        },
      ],
    });
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
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/video' }),  // Changed to avoid partial match
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_SOURCE_URL');
  });

  it('should return video info for valid URL', async () => {
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
      quality: '1080p',
    });
    expect(data.thumbnail).toContain('maxresdefault.jpg');
    expect(mockYoutubedl).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=test123',
      expect.objectContaining({
        dumpSingleJson: true,
      })
    );
  });

  it('should handle youtu.be short URLs', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtu.be/test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videoId).toBe('test123');
  });

  it('should return highest quality from formats', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return 1080p (highest available in mock)
    expect(data.quality).toBe('1080p');
  });

  it('should handle videos with no video-only formats', async () => {
    vi.mocked(mockYoutubedl).mockResolvedValueOnce({
      id: 'test456',
      title: 'Test Video',
      uploader: 'Test Creator',
      thumbnail: 'https://i.ytimg.com/vi/test456/maxresdefault.jpg',
      duration: 120,
      view_count: 1000,
      formats: [
        {
          format_id: '18',
          vcodec: 'avc1',
          acodec: 'mp4a',
          height: 360,
        },
      ],
    });

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test456' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.quality).toBe('HD'); // Falls back to 'HD' when no video-only formats
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(mockYoutubedl).mockRejectedValueOnce(new Error('Video unavailable'));

    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=error' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('TARGET_UNREACHABLE');
  });

  it('should format view count as string', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(typeof data.viewCount).toBe('string');
    expect(data.viewCount).toBe('5000');
  });

  it('should format duration as string', async () => {
    const request = new NextRequest('http://localhost:3000/api/video-info', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(typeof data.lengthSeconds).toBe('string');
    expect(data.lengthSeconds).toBe('180');
  });
});
