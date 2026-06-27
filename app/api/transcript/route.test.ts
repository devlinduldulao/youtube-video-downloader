// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the /api/transcript route handler.
 *
 * The handler spawns yt-dlp twice (in parallel via Promise.all):
 *   1. `--print` to get the title/uploader
 *   2. `--skip-download --write-subs ...` to download the subtitle file
 * It then reads the downloaded .vtt from a temp dir via `fs`.
 *
 * We mock both `child_process.spawn` and `fs` so the tests are fast and
 * deterministic and never touch the network or disk.
 *
 * Spawn ordering: Promise.all evaluates its array left-to-right, so the
 * metadata spawn is always call #1 and the subtitle spawn is call #2.
 */

const mockSpawn = vi.hoisted(() => vi.fn());

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => ['transcript.en.vtt']),
  readFileSync: vi.fn(() => ''),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs', () => fsMocks);

import { POST } from './route';
import { NextRequest } from 'next/server';

// ── Mock child process ──────────────────────────────────────────────────
function createMockProcess() {
  type Listener = (...args: unknown[]) => void;
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

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
This is a transcript`;

/**
 * Drive a full successful run: emit metadata on spawn #1, close both procs.
 * Returns the resolved Response.
 */
async function runSuccess(
  body: Record<string, unknown>,
  metaStdout = 'My Cool Video\nCool Creator',
) {
  const metaProc = createMockProcess();
  const subsProc = createMockProcess();
  mockSpawn.mockReturnValueOnce(metaProc).mockReturnValueOnce(subsProc);

  const responsePromise = POST(createRequest(body));

  await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));

  metaProc._emitStdout(metaStdout);
  metaProc._emit('close', 0);
  subsProc._emit('close', 0);

  return { response: await responsePromise, metaProc, subsProc };
}

describe('/api/transcript POST', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    fsMocks.existsSync.mockReset().mockReturnValue(true);
    fsMocks.readdirSync.mockReset().mockReturnValue(['transcript.en.vtt']);
    fsMocks.readFileSync.mockReset().mockReturnValue(SAMPLE_VTT);
    fsMocks.mkdirSync.mockReset();
    fsMocks.rmSync.mockReset();
  });

  // ── Validation (unhappy) ─────────────────────────────────────────────
  describe('request validation', () => {
    it('returns 400 when URL is missing', async () => {
      const response = await POST(createRequest({}));
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.error).toBe('URL_REQUIRED');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-YouTube URL', async () => {
      const response = await POST(createRequest({ url: 'https://vimeo.com/1' }));
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.error).toBe('INVALID_SOURCE_URL');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('returns 400 when url is not a string', async () => {
      const response = await POST(createRequest({ url: 12345 }));
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.error).toBe('URL_REQUIRED');
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────
  describe('successful transcript extraction', () => {
    it('returns a formatted plain-text transcript with metadata', async () => {
      const { response } = await runSuccess({
        url: 'https://youtube.com/watch?v=abc123',
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.format).toBe('txt');
      expect(json.language).toBe('en');
      expect(json.cueCount).toBe(2);
      expect(json.filename).toBe('My Cool Video.en.txt');
      expect(json.transcript).toContain('# My Cool Video');
      expect(json.transcript).toContain('# Channel: Cool Creator');
      expect(json.transcript).toContain('Hello world');
      expect(json.transcript).toContain('This is a transcript');
    });

    it('produces SRT output when format=srt', async () => {
      const { response } = await runSuccess({
        url: 'https://youtu.be/abc123',
        format: 'srt',
      });
      const json = await response.json();

      expect(json.format).toBe('srt');
      expect(json.filename).toBe('My Cool Video.en.srt');
      expect(json.transcript).toContain('00:00:00,000 --> 00:00:02,000');
      expect(json.transcript).toMatch(/^1\n/);
    });

    it('produces timestamped output when format=timestamped', async () => {
      const { response } = await runSuccess({
        url: 'https://youtu.be/abc123',
        format: 'timestamped',
      });
      const json = await response.json();

      expect(json.format).toBe('timestamped');
      expect(json.filename).toBe('My Cool Video.en.txt');
      expect(json.transcript).toContain('[00:00:00] Hello world');
    });

    it('falls back to txt for an unrecognized format', async () => {
      const { response } = await runSuccess({
        url: 'https://youtu.be/abc123',
        format: 'pdf',
      });
      const json = await response.json();
      expect(json.format).toBe('txt');
    });

    it('infers the language from the downloaded subtitle filename', async () => {
      fsMocks.readdirSync.mockReturnValue(['transcript.es.vtt']);
      const { response } = await runSuccess({
        url: 'https://youtu.be/abc123',
        lang: 'es',
      });
      const json = await response.json();
      expect(json.language).toBe('es');
      expect(json.filename).toBe('My Cool Video.es.txt');
    });

    it('prefers the clean manual track over the auto-generated "-orig" track', async () => {
      // yt-dlp often writes both; we should pick the clean "en" one.
      fsMocks.readFileSync.mockReturnValue(SAMPLE_VTT);
      fsMocks.readdirSync.mockReturnValue([
        'transcript.en-orig.vtt',
        'transcript.en.vtt',
      ]);
      const { response } = await runSuccess({ url: 'https://youtu.be/abc123' });
      const json = await response.json();
      expect(json.language).toBe('en');
    });

    it('succeeds despite a non-zero yt-dlp exit when a usable file exists', async () => {
      // Simulate yt-dlp exiting non-zero (e.g. one language 429'd) but still
      // writing transcript.en.vtt. We should still return the transcript.
      const metaProc = createMockProcess();
      const subsProc = createMockProcess();
      mockSpawn.mockReturnValueOnce(metaProc).mockReturnValueOnce(subsProc);

      const responsePromise = POST(
        createRequest({ url: 'https://youtu.be/partial' }),
      );
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));

      metaProc._emitStdout('Partial Video\nCreator');
      metaProc._emit('close', 0);
      subsProc._emitStderr('ERROR: Unable to download subtitles for "en-de": 429');
      subsProc._emit('close', 1); // non-zero, but transcript.en.vtt exists

      const response = await responsePromise;
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.cueCount).toBe(2);
    });

    it('requests the subtitle download with the expected yt-dlp args', async () => {
      const { subsProc } = await runSuccess({
        url: 'https://youtu.be/argtest',
        lang: 'fr',
      });
      void subsProc;

      // The 2nd spawn call is the subtitle download.
      const subsArgs = mockSpawn.mock.calls[1][1] as string[];
      expect(subsArgs).toContain('--skip-download');
      expect(subsArgs).toContain('--write-subs');
      expect(subsArgs).toContain('--write-auto-subs');
      expect(subsArgs).toContain('--no-playlist');
      // Custom language is wired into --sub-langs.
      const langIndex = subsArgs.indexOf('--sub-langs');
      expect(subsArgs[langIndex + 1]).toBe('fr.*,fr');
    });

    it('defaults the language to en and ignores an unsafe lang value', async () => {
      const { subsProc } = await runSuccess({
        url: 'https://youtu.be/abc123',
        lang: '; rm -rf /',
      });
      void subsProc;
      const subsArgs = mockSpawn.mock.calls[1][1] as string[];
      const langIndex = subsArgs.indexOf('--sub-langs');
      expect(subsArgs[langIndex + 1]).toBe('en.*,en');
    });

    it('cleans up the temp directory afterwards', async () => {
      await runSuccess({ url: 'https://youtu.be/abc123' });
      expect(fsMocks.rmSync).toHaveBeenCalled();
    });
  });

  // ── No-transcript / content errors ───────────────────────────────────
  describe('missing or empty transcripts', () => {
    it('returns 404 when no subtitle file was downloaded', async () => {
      fsMocks.readdirSync.mockReturnValue([]); // no .vtt produced
      const { response } = await runSuccess({ url: 'https://youtu.be/abc123' });
      const json = await response.json();
      expect(response.status).toBe(404);
      expect(json.error).toBe('NO_TRANSCRIPT_AVAILABLE');
    });

    it('returns 404 when the subtitle file has no usable cues', async () => {
      fsMocks.readFileSync.mockReturnValue('WEBVTT\n\n'); // header only
      const { response } = await runSuccess({ url: 'https://youtu.be/abc123' });
      const json = await response.json();
      expect(response.status).toBe(404);
      expect(json.error).toBe('NO_TRANSCRIPT_CONTENT');
    });
  });

  // ── yt-dlp failures (unhappy) ────────────────────────────────────────
  describe('yt-dlp failures', () => {
    it('returns 404 when yt-dlp fails and produces no subtitle file', async () => {
      fsMocks.readdirSync.mockReturnValue([]); // nothing was written
      const metaProc = createMockProcess();
      const subsProc = createMockProcess();
      mockSpawn.mockReturnValueOnce(metaProc).mockReturnValueOnce(subsProc);

      const responsePromise = POST(
        createRequest({ url: 'https://youtu.be/fail' }),
      );
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));

      metaProc._emitStdout('Title\nAuthor');
      metaProc._emit('close', 0);
      subsProc._emitStderr('ERROR: video unavailable');
      subsProc._emit('close', 1);

      const response = await responsePromise;
      const json = await response.json();
      expect(response.status).toBe(404);
      expect(json.error).toBe('NO_TRANSCRIPT_AVAILABLE');
    });

    it('returns 500 when yt-dlp cannot be spawned', async () => {
      const metaProc = createMockProcess();
      const subsProc = createMockProcess();
      mockSpawn.mockReturnValueOnce(metaProc).mockReturnValueOnce(subsProc);

      const responsePromise = POST(
        createRequest({ url: 'https://youtu.be/nobin' }),
      );
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));

      metaProc._emit('error', new Error('spawn yt-dlp ENOENT'));
      subsProc._emit('error', new Error('spawn yt-dlp ENOENT'));

      const response = await responsePromise;
      const json = await response.json();
      expect(response.status).toBe(500);
      expect(json.error).toBe('TRANSCRIPT_FAILED');
    });
  });
});
