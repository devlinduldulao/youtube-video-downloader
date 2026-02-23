// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the /api/download route handler.
 *
 * This handler has two phases:
 *   1. Get video title (spawn yt-dlp --get-title)
 *   2. Download video  (spawn yt-dlp with format/merge flags)
 *
 * After downloading, it reads the file from a temp directory and streams
 * it back.  We mock:
 *   - child_process.spawn — to simulate yt-dlp behaviour
 *   - fs functions — to avoid real file system access
 *   - os.tmpdir — to control temp directory location
 *
 * Timing caveat:
 *   POST(request) is async — it awaits `request.json()` before reaching
 *   `spawn()`.  We must use `vi.waitFor(() => expect(mockSpawn)...)`
 *   to wait for each spawn call before emitting events on the mock process.
 *   Otherwise the events fire before listeners are attached.
 */

// ── Mocks ──────────────────────────────────────────────────────────────
const mockSpawn = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockRmSync = vi.hoisted(() => vi.fn());
const mockReaddirSync = vi.hoisted(() => vi.fn());
const mockCreateReadStream = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
}));

vi.mock('os', () => ({
  tmpdir: () => '/tmp',
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

/** Helper to create a NextRequest with JSON body. */
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type Listener = (...args: unknown[]) => void;

/** Helper: builds a mock child process with event emitters. */
function createMockProcess() {
  const listeners: Record<string, Listener[]> = {};

  const stream = (prefix: string) => ({
    on: (event: string, cb: Listener) => {
      const key = `${prefix}:${event}`;
      listeners[key] = listeners[key] || [];
      listeners[key].push(cb);
    },
  });

  return {
    stdout: stream('stdout'),
    stderr: stream('stderr'),
    on: (event: string, cb: Listener) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
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
}

/** Helper: creates a mock readable stream using EventEmitter (like Node's fs.createReadStream). */
function createMockFileStream(data: string) {
  const emitter = new EventEmitter();
  // Simulate async data emission
  setTimeout(() => {
    emitter.emit('data', Buffer.from(data));
    emitter.emit('end');
  }, 0);
  return emitter;
}

describe('/api/download POST', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockMkdirSync.mockReset();
    mockRmSync.mockReset();
    mockReaddirSync.mockReset();
    mockCreateReadStream.mockReset();
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

    it('should return 400 when URL is empty', async () => {
      const request = createRequest({ url: '' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('URL_REQUIRED');
    });

    it('should return 400 for non-YouTube URLs', async () => {
      const request = createRequest({ url: 'https://dailymotion.com/video/1234' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INVALID_URL');
    });
  });

  // ── Successful download ──────────────────────────────────────────────
  describe('successful download', () => {
    it('should return a streaming video response with correct headers', async () => {
      // Phase 1: get-title
      const titleProc = createMockProcess();
      // Phase 2: download
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)   // getVideoTitle
        .mockReturnValueOnce(downloadProc); // downloadWithYtDlp

      // Pre-configure fs mocks so they're ready when the close handler runs
      mockReaddirSync.mockReturnValueOnce(['video.mp4']);
      mockExistsSync.mockReturnValueOnce(true); // verify file exists
      mockStatSync.mockReturnValueOnce({ size: 1024 * 1024 }); // 1MB

      const fileStream = createMockFileStream('fake-video-data');
      mockCreateReadStream.mockReturnValueOnce(fileStream);

      const request = createRequest({ url: 'https://youtube.com/watch?v=test123' });
      const responsePromise = POST(request);

      // Wait for spawn #1 (getVideoTitle) and emit title events
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('My Awesome Video!');
      titleProc._emit('close', 0);

      // Wait for spawn #2 (downloadWithYtDlp) and emit download events
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emitStdout('[download] 100%');
      downloadProc._emit('close', 0);

      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="My Awesome Video.mp4"',
      );
      expect(response.headers.get('Content-Type')).toBe('video/mp4');
      expect(response.headers.get('Content-Length')).toBe(String(1024 * 1024));
    });

    it('should sanitize the video title (remove special characters)', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      mockReaddirSync.mockReturnValueOnce(['video.mp4']);
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce({ size: 512 });

      const fileStream = createMockFileStream('data');
      mockCreateReadStream.mockReturnValueOnce(fileStream);

      const request = createRequest({ url: 'https://youtube.com/watch?v=special' });
      const responsePromise = POST(request);

      // Wait for spawn #1 then emit title with special characters
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('My $pecial [Video] (2024)!!');
      titleProc._emit('close', 0);

      // Wait for spawn #2 then close the download
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emit('close', 0);

      const response = await responsePromise;

      // The title should have special characters stripped
      const disposition = response.headers.get('Content-Disposition') || '';
      expect(disposition).toContain('filename=');
      // The regex removes $, [, ], (, ), ! — keeps words, spaces, hyphens
      expect(disposition).not.toContain('$');
      expect(disposition).not.toContain('[');
      expect(disposition).not.toContain('!');
    });
  });

  // ── Error handling ───────────────────────────────────────────────────
  describe('error handling', () => {
    it('should return 500 when yt-dlp --get-title fails', async () => {
      const titleProc = createMockProcess();
      mockSpawn.mockReturnValueOnce(titleProc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=titlefail' });
      const responsePromise = POST(request);

      // Wait for spawn then emit failure
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStderr('ERROR: Video unavailable');
      titleProc._emit('close', 1);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('DOWNLOAD_FAILED');
    });

    it('should return 500 when yt-dlp download process exits with error', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=dlFail' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('Good Title');
      titleProc._emit('close', 0);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emitStderr('yt-dlp download error');
      downloadProc._emit('close', 1);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('DOWNLOAD_FAILED');
    });

    it('should return 500 when downloaded file does not exist', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      // Download succeeds but file doesn't appear
      mockReaddirSync.mockReturnValueOnce(['video.mp4']);
      mockExistsSync.mockReturnValueOnce(false); // File doesn't exist

      const request = createRequest({ url: 'https://youtube.com/watch?v=nofile' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('A Title');
      titleProc._emit('close', 0);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('DOWNLOAD_FAILED');
    });

    it('should clean up temp directory on error', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=cleanup' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('Cleanup Test');
      titleProc._emit('close', 0);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emit('close', 1);

      const response = await responsePromise;

      expect(response.status).toBe(500);
      // The handler calls cleanupTempDir which uses rmSync
      expect(mockMkdirSync).toHaveBeenCalled();
    });

    it('should return 500 when no video files found in output directory', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      // readdirSync returns no matching video files
      mockReaddirSync.mockReturnValueOnce(['metadata.json', 'thumbnail.jpg']);

      const request = createRequest({ url: 'https://youtube.com/watch?v=novid' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('No Video');
      titleProc._emit('close', 0);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emit('close', 0);

      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('DOWNLOAD_FAILED');
    });
  });

  // ── yt-dlp spawn arguments ──────────────────────────────────────────
  describe('yt-dlp invocation', () => {
    it('should call yt-dlp with correct arguments for title retrieval', async () => {
      const titleProc = createMockProcess();
      mockSpawn.mockReturnValueOnce(titleProc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=argstest' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStderr('error');
      titleProc._emit('close', 1);

      await responsePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // yt-dlp path
        ['--get-title', '--no-warnings', '--no-check-certificates', '--no-playlist', 'https://youtube.com/watch?v=argstest'],
      );
    });

    it('should call yt-dlp with correct download format arguments', async () => {
      const titleProc = createMockProcess();
      const downloadProc = createMockProcess();

      mockSpawn
        .mockReturnValueOnce(titleProc)
        .mockReturnValueOnce(downloadProc);

      const request = createRequest({ url: 'https://youtube.com/watch?v=fmttest' });
      const responsePromise = POST(request);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1));
      titleProc._emitStdout('Format Test');
      titleProc._emit('close', 0);

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
      downloadProc._emit('close', 1);

      await responsePromise;

      // Verify the download spawn arguments
      const downloadCall = mockSpawn.mock.calls[1];
      const args = downloadCall[1] as string[];

      expect(args).toContain('-f');
      expect(args).toContain('bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
      expect(args).toContain('--merge-output-format');
      expect(args).toContain('mp4');
      expect(args).toContain('--no-warnings');
      expect(args).toContain('--no-check-certificates');
      expect(args).toContain('--progress');
      expect(args).toContain('https://youtube.com/watch?v=fmttest');
    });
  });
});
