// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the /api/video-info route handler.
 *
 * Architecture note — testing Next.js route handlers:
 *   Route handlers in the App Router export async functions (GET, POST, etc.)
 *   that accept a `NextRequest` and return a `NextResponse`.  We can import
 *   and call them directly like any async function — no need for a running
 *   HTTP server.  This is one of the benefits of Next.js route handlers
 *   over the older Pages Router API routes.
 *
 * Mocking strategy:
 *   The route handler uses `child_process.spawn` to call `yt-dlp`.
 *   We mock `spawn` to avoid requiring the actual binary during tests.
 *   We simulate the stdout/stderr/close events of a child process.
 *
 * Timing caveat — why we use `vi.waitFor` before emitting events:
 *   When we call `POST(request)`, the handler is async. It awaits
 *   `request.json()` before reaching `spawn()`.  If we emit events
 *   immediately after starting the request, the process listeners
 *   haven't been attached yet and events are silently lost.
 *   `vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())` polls
 *   until `spawn` has been called, guaranteeing listeners are ready.
 */

// ── Mock child_process.spawn ──────────────────────────────────────────
const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Import AFTER mocking — this ensures the route handler picks up our mock.
import { POST } from './route';
import { NextRequest } from 'next/server';

/**
 * Helper: creates a mock child process that emits events.
 *
 * In Node.js, `spawn()` returns a ChildProcess object with:
 *   - stdout (a Readable stream — emits 'data')
 *   - stderr (a Readable stream — emits 'data')
 *   - events: 'close' (exit code), 'error'
 *
 * We build a minimal event-emitter-like object so our mock
 * behaves realistically.
 */
function createMockProcess() {
  type Listener = (...args: unknown[]) => void;
  const listeners: Record<string, Listener[]> = {};

  const createStream = () => ({
    on: (event: string, cb: Listener) => {
      const key = `stdout:${event}`;
      listeners[key] = listeners[key] || [];
      listeners[key].push(cb);
    },
  });

  const stderrStream = () => ({
    on: (event: string, cb: Listener) => {
      const key = `stderr:${event}`;
      listeners[key] = listeners[key] || [];
      listeners[key].push(cb);
    },
  });

  const process = {
    stdout: createStream(),
    stderr: stderrStream(),
    on: (event: string, cb: Listener) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    // Helpers for tests to trigger events
    _emit: (event: string, ...args: unknown[]) => {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
    _emitStdout: (data: string) => {
      (listeners['stdout:data'] || []).forEach((cb) => cb(Buffer.from(data)));
    },
    _emitStderr: (data: string) => {
      (listeners['stderr:data'] || []).forEach((cb) => cb(Buffer.from(data)));
    },
  };

  return process;
}

/** Helper to build a NextRequest with a JSON body. */
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/video-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/video-info POST', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  // ── Validation ───────────────────────────────────────────────────────
  describe('request validation', () => {
    it('should return 400 when URL is missing', async () => {
      const request = createRequest({});
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('URL_REQUIRED');
    });

    it('should return 400 when URL is empty string', async () => {
      const request = createRequest({ url: '' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('URL_REQUIRED');
    });

    it('should return 400 for an invalid (non-YouTube) URL', async () => {
      const request = createRequest({ url: 'https://vimeo.com/12345' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INVALID_SOURCE_URL');
    });

    it('should return 400 for a random string', async () => {
      const request = createRequest({ url: 'not-a-url-at-all' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INVALID_SOURCE_URL');
    });
  });

  // ── URL validation (valid patterns) ─────────────────────────────────
  describe('YouTube URL validation', () => {
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'http://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/v/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ];

    for (const url of validUrls) {
      it(`should accept valid YouTube URL: ${url}`, async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValueOnce(proc);

        const request = createRequest({ url });
        const responsePromise = POST(request);

        // Wait for the handler to call spawn() and attach listeners
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

        const ytDlpOutput = JSON.stringify({
          id: 'dQw4w9WgXcQ',
          title: 'Test Video',
          uploader: 'Test Channel',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          duration: 120,
          view_count: 5000,
          formats: [
            { vcodec: 'avc1', acodec: 'none', height: 1080, format_note: '1080p' },
            { vcodec: 'avc1', acodec: 'none', height: 720, format_note: '720p' },
          ],
        });

        proc._emitStdout(ytDlpOutput);
        proc._emit('close', 0);

        const response = await responsePromise;
        // If it passes validation, it will either succeed (200)
        // or fail with an internal error (500), but NOT 400.
        expect(response.status).not.toBe(400);
      });
    }
  });

  // ── Successful response ──────────────────────────────────────────────
  describe('successful video info retrieval', () => {
    it('should return video metadata from yt-dlp output', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=abc123' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      const ytDlpOutput = JSON.stringify({
        id: 'abc123',
        title: 'My Cool Video',
        uploader: 'Cool Creator',
        thumbnail: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
        duration: 300,
        view_count: 42000,
        formats: [
          { vcodec: 'avc1', acodec: 'none', height: 1080, format_note: '1080p' },
          { vcodec: 'avc1', acodec: 'none', height: 720, format_note: '720p' },
          { vcodec: 'none', acodec: 'mp4a', height: null }, // audio-only format
        ],
      });

      proc._emitStdout(ytDlpOutput);
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        videoId: 'abc123',
        title: 'My Cool Video',
        author: 'Cool Creator',
        thumbnail: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
        quality: '1080p',
        lengthSeconds: '300',
        viewCount: '42000',
      });
    });

    it('should use "channel" as fallback author when "uploader" is missing', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=test1' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout(
        JSON.stringify({
          id: 'test1',
          title: 'Channel Only',
          channel: 'My Channel',
          thumbnail: 'https://thumb.jpg',
          duration: 60,
          view_count: 100,
          formats: [],
        }),
      );
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(json.author).toBe('My Channel');
    });

    it('should use "Unknown" when neither uploader nor channel exists', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=test2' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout(
        JSON.stringify({
          id: 'test2',
          title: 'No Author',
          thumbnail: 'https://thumb.jpg',
          duration: 30,
          view_count: 0,
          formats: [],
        }),
      );
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(json.author).toBe('Unknown');
    });

    it('should show "HD" quality when no video formats have height info', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=nofmt' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout(
        JSON.stringify({
          id: 'nofmt',
          title: 'No Format',
          uploader: 'Creator',
          thumbnail: 'https://thumb.jpg',
          duration: 10,
          view_count: 1,
          formats: [],
        }),
      );
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(json.quality).toBe('HD');
    });

    it('should select the highest resolution format', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=multi' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout(
        JSON.stringify({
          id: 'multi',
          title: 'Multi Res',
          uploader: 'Creator',
          thumbnail: 'https://thumb.jpg',
          duration: 100,
          view_count: 999,
          formats: [
            { vcodec: 'avc1', acodec: 'none', height: 480, format_note: '480p' },
            { vcodec: 'avc1', acodec: 'none', height: 1440, format_note: '1440p' },
            { vcodec: 'avc1', acodec: 'none', height: 720, format_note: '720p' },
            { vcodec: 'avc1', acodec: 'none', height: 2160, format_note: '4K' },
          ],
        }),
      );
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      // The route code has a JS operator precedence quirk:
      //   bestFormat?.format_note || bestFormat?.height ? `${bestFormat.height}p` : 'HD'
      // Ternary (? :) has LOWER precedence than ||, so it evaluates as:
      //   (format_note || height) ? `${height}p` : 'HD'
      // Result: always `${height}p` when format exists, regardless of format_note.
      expect(json.quality).toBe('2160p');
    });
  });

  // ── Error handling ───────────────────────────────────────────────────
  describe('error handling', () => {
    it('should return 500 when yt-dlp exits with non-zero code', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=err' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStderr('ERROR: Video unavailable');
      proc._emit('close', 1); // Non-zero exit code

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('TARGET_UNREACHABLE');
    });

    it('should return 500 when yt-dlp fails to start (e.g. not installed)', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=nobin' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emit('error', new Error('spawn yt-dlp ENOENT'));

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('TARGET_UNREACHABLE');
    });

    it('should return 500 when yt-dlp output is not valid JSON', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=badjson' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout('this is not json');
      proc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('TARGET_UNREACHABLE');
    });
  });

  // ── yt-dlp spawn arguments ──────────────────────────────────────────
  describe('yt-dlp invocation', () => {
    it('should call yt-dlp with the correct arguments', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValueOnce(proc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=args' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

      proc._emitStdout(
        JSON.stringify({
          id: 'args',
          title: 'Test',
          uploader: 'A',
          thumbnail: 'x',
          duration: 1,
          view_count: 1,
          formats: [],
        }),
      );
      proc._emit('close', 0);

      await responsePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // yt-dlp path
        [
          '--dump-json',
          '--no-warnings',
          '--no-download',
          '--no-check-certificates',
          '--no-playlist',
          'https://youtube.com/watch?v=args',
        ],
      );
    });
  });
});
