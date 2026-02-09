import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadPage } from './download-page';
import { toast } from 'sonner';

/**
 * Tests for the DownloadPage component — the main "cyberpunk" UI.
 *
 * This component has a two-step flow:
 *   1. User enters a URL and clicks INITIALIZE → fetches video info.
 *   2. If info is found, metadata is displayed and user clicks EXECUTE_DOWNLOAD.
 *
 * What we test:
 *   - Initial render (header, input, button, footer status)
 *   - The "fetch info" flow (loading, success, error)
 *   - The "download" flow (blob download, toast notifications)
 *   - Helper functions (formatDuration, formatViews) through the UI
 *
 * Why we mock `fetch` instead of MSW:
 *   For a small project, `vi.spyOn(global, 'fetch')` gives us precise
 *   control with minimal setup.  MSW is better for large apps with many
 *   endpoints or when you need realistic network interception.
 */
describe('DownloadPage', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    vi.mocked(toast.loading).mockReturnValue('toast-id');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── Helper: mock video info response ────────────────────────────────
  const mockVideoInfo = {
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    author: 'Rick Astley',
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    quality: '1080p',
    lengthSeconds: '212',
    viewCount: '1500000000',
  };

  function mockFetchInfoSuccess() {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockVideoInfo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  function mockFetchInfoError(errorMsg = 'TARGET_UNREACHABLE') {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  // ── Rendering ────────────────────────────────────────────────────────
  describe('rendering', () => {
    it('should render the main heading "YT_EXTRACT"', () => {
      render(<DownloadPage />);
      expect(screen.getByText('YT_EXTRACT')).toBeInTheDocument();
    });

    it('should render the version badge', () => {
      render(<DownloadPage />);
      expect(screen.getByText('v.2.0')).toBeInTheDocument();
    });

    it('should render the SYSTEM_READY status indicator', () => {
      render(<DownloadPage />);
      expect(screen.getByText('SYSTEM_READY')).toBeInTheDocument();
    });

    it('should render the URL input with placeholder', () => {
      render(<DownloadPage />);
      expect(screen.getByPlaceholderText('INPUT_SOURCE_URL')).toBeInTheDocument();
    });

    it('should render the INITIALIZE button', () => {
      render(<DownloadPage />);
      expect(screen.getByText('INITIALIZE')).toBeInTheDocument();
    });

    it('should render the footer with READY status', () => {
      render(<DownloadPage />);
      expect(screen.getByText(/STATUS: READY/)).toBeInTheDocument();
    });

    it('should render the copyright notice', () => {
      render(<DownloadPage />);
      expect(screen.getByText(/YT_EXTRACT_SYSTEM © 2026/)).toBeInTheDocument();
    });

    it('should disable INITIALIZE button when input is empty', () => {
      render(<DownloadPage />);
      // The button has disabled={loading || !url}
      // Since url is '' initially, the button should be disabled
      const buttons = screen.getAllByRole('button');
      const initButton = buttons.find((b) => b.textContent?.includes('INITIALIZE'));
      expect(initButton).toBeDisabled();
    });

    it('should render the ThemeToggle component', () => {
      render(<DownloadPage />);
      // ThemeToggle renders Light/Dim/Dark buttons
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });

  // ── Fetch video info flow ────────────────────────────────────────────
  describe('fetch video info', () => {
    it('should fetch video info when INITIALIZE is clicked', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
      await user.click(screen.getByText('INITIALIZE'));

      expect(fetchSpy).toHaveBeenCalledWith('/api/video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }),
      });
    });

    it('should show SCANNING text during loading', async () => {
      const user = userEvent.setup();

      // Never-resolving promise to keep loading state
      let resolveRequest: (value: Response) => void;
      fetchSpy.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtu.be/test');
      await user.click(screen.getByText('INITIALIZE'));

      expect(screen.getByText('SCANNING')).toBeInTheDocument();

      // Also check footer shows ACTIVE status
      expect(screen.getByText(/STATUS: ACTIVE/)).toBeInTheDocument();

      // Clean up by resolving
      resolveRequest!(new Response(JSON.stringify(mockVideoInfo), { status: 200 }));
    });

    it('should display video metadata after successful fetch', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
      });

      // Check author is uppercased
      expect(screen.getByText(/RICK ASTLEY/)).toBeInTheDocument();

      // Check video ID is displayed
      expect(screen.getByText(/dQw4w9WgXcQ/)).toBeInTheDocument();

      // Check quality
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    it('should show formatted duration (3:32 for 212 seconds)', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        // 212 seconds = 3 minutes 32 seconds → "3:32"
        expect(screen.getByText('3:32')).toBeInTheDocument();
      });
    });

    it('should show formatted view count (1.5B → 1500.0M)', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        // 1,500,000,000 → "1500.0M"
        expect(screen.getByText('1500.0M')).toBeInTheDocument();
      });
    });

    it('should show the EXECUTE_DOWNLOAD button after info is fetched', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=test');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText('EXECUTE_DOWNLOAD')).toBeInTheDocument();
      });
    });

    it('should display error when fetch info fails', async () => {
      const user = userEvent.setup();
      mockFetchInfoError('TARGET_UNREACHABLE');

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=bad');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText(/ERROR: TARGET_UNREACHABLE/)).toBeInTheDocument();
      });
    });

    it('should display generic error when fetch throws a network error', async () => {
      const user = userEvent.setup();
      fetchSpy.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=net-err');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText(/ERROR: Failed to fetch/)).toBeInTheDocument();
      });
    });

    it('should fetch info when Enter key is pressed', async () => {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
      await user.type(input, 'https://youtube.com/watch?v=enter-test');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/video-info', expect.any(Object));
      });
    });

    it('should not fetch info when Enter is pressed with empty input', async () => {
      const user = userEvent.setup();
      render(<DownloadPage />);

      const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── Download flow ────────────────────────────────────────────────────
  describe('execute download', () => {
    /**
     * Helper to get the component into the "video info loaded" state
     * so we can test the download button.
     */
    async function setupWithVideoInfo() {
      const user = userEvent.setup();
      mockFetchInfoSuccess();

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText('EXECUTE_DOWNLOAD')).toBeInTheDocument();
      });

      return user;
    }

    it('should trigger download and show success status', async () => {
      const user = await setupWithVideoInfo();

      // Mock the download endpoint
      const mockBlob = new Blob(['fake-video'], { type: 'video/mp4' });
      fetchSpy.mockResolvedValueOnce(
        new Response(mockBlob, {
          status: 200,
          headers: {
            'Content-Disposition': 'attachment; filename="Never Gonna Give You Up.mp4"',
            'Content-Type': 'video/mp4',
          },
        }),
      );

      await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

      await waitFor(() => {
        expect(screen.getByText('EXTRACTION_COMPLETE')).toBeInTheDocument();
      });

      // Verify the download API was called
      expect(fetchSpy).toHaveBeenCalledWith('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }),
      });

      // Toast should have been called
      expect(toast.loading).toHaveBeenCalledWith('Initiating download protocol...');
      expect(toast.success).toHaveBeenCalledWith('Download successfully executed!', expect.objectContaining({
        id: 'toast-id',
      }));
    });

    it('should show EXTRACTING text during download', async () => {
      const user = await setupWithVideoInfo();

      // Never-resolving promise
      let resolveDownload: (value: Response) => void;
      fetchSpy.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
      );

      await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

      expect(screen.getByText('EXTRACTING')).toBeInTheDocument();

      // Clean up
      resolveDownload!(new Response(new Blob(['data']), { status: 200 }));
    });

    it('should show error toast when download fails', async () => {
      const user = await setupWithVideoInfo();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'DOWNLOAD_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should display download file details after success', async () => {
      const user = await setupWithVideoInfo();

      const mockBlob = new Blob(['data'], { type: 'video/mp4' });
      fetchSpy.mockResolvedValueOnce(
        new Response(mockBlob, {
          status: 200,
          headers: {
            'Content-Disposition': 'attachment; filename="cool-video.mp4"',
            'Content-Type': 'video/mp4',
          },
        }),
      );

      await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

      await waitFor(() => {
        expect(screen.getByText(/cool-video\.mp4/)).toBeInTheDocument();
        expect(screen.getByText(/System Downloads Folder/)).toBeInTheDocument();
      });
    });

    it('should use "download.mp4" as default filename when header is missing', async () => {
      const user = await setupWithVideoInfo();

      const mockBlob = new Blob(['data'], { type: 'video/mp4' });
      fetchSpy.mockResolvedValueOnce(
        new Response(mockBlob, {
          status: 200,
          // No Content-Disposition header
        }),
      );

      await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

      await waitFor(() => {
        expect(screen.getByText(/download\.mp4/)).toBeInTheDocument();
      });
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('should clear previous error when a new fetch is initiated', async () => {
      const user = userEvent.setup();

      // First call fails
      mockFetchInfoError('FIRST_ERROR');

      render(<DownloadPage />);
      const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');

      await user.type(input, 'https://youtube.com/watch?v=bad');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.getByText(/ERROR: FIRST_ERROR/)).toBeInTheDocument();
      });

      // Second call succeeds — error should clear
      mockFetchInfoSuccess();
      await user.clear(input);
      await user.type(input, 'https://youtube.com/watch?v=good');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        expect(screen.queryByText(/ERROR/)).not.toBeInTheDocument();
        expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
      });
    });

    it('should handle non-Error throws gracefully', async () => {
      const user = userEvent.setup();

      // Simulating a throw with a non-Error value
      fetchSpy.mockRejectedValueOnce('string-error');

      render(<DownloadPage />);

      await user.type(screen.getByPlaceholderText('INPUT_SOURCE_URL'), 'https://youtube.com/watch?v=test');
      await user.click(screen.getByText('INITIALIZE'));

      await waitFor(() => {
        // Should fall through to the generic error path
        expect(screen.getByText(/CONNECTION_REFUSED/)).toBeInTheDocument();
      });
    });
  });
});
