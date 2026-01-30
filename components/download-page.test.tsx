/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadPage } from '@/components/download-page';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
    default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
    },
}));

// Mock next-themes
vi.mock('next-themes', () => ({
    useTheme: () => ({
        theme: 'dark',
        setTheme: vi.fn(),
        resolvedTheme: 'dark',
    }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('DownloadPage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockReset();
    });

    it('should render the main interface', () => {
        render(<DownloadPage />);

        expect(screen.getByText('YT_EXTRACT')).toBeInTheDocument();
        expect(screen.getByText('v.2.0')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('INPUT_SOURCE_URL')).toBeInTheDocument();
        expect(screen.getByText('INITIALIZE')).toBeInTheDocument();
    });

    it('should display system ready status', () => {
        render(<DownloadPage />);

        expect(screen.getByText('SYSTEM_READY')).toBeInTheDocument();
    });

    it('should handle URL input', async () => {
        const user = userEvent.setup();
        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        expect(input).toHaveValue('https://www.youtube.com/watch?v=test123');
    });

    it('should fetch video info when Initialize button is clicked', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Test Video',
            author: 'Test Author',
            thumbnail: 'https://i.ytimg.com/vi/test123/maxresdefault.jpg',
            quality: '1080p',
            lengthSeconds: '180',
            viewCount: '5000',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        const initButton = screen.getByText('INITIALIZE');
        await user.click(initButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/video-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
            });
        });

        await waitFor(() => {
            expect(screen.getByText('Test Video')).toBeInTheDocument();
            expect(screen.getByText(/Test Author/i)).toBeInTheDocument();
            expect(screen.getByText('1080p')).toBeInTheDocument();
        });
    });

    it('should show loading state during fetch', async () => {
        const user = userEvent.setup();

        (global.fetch as any).mockImplementationOnce(() =>
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                json: async () => ({
                    videoId: 'test123',
                    title: 'Test',
                    author: 'Author',
                    thumbnail: 'thumb.jpg',
                    quality: '720p',
                    lengthSeconds: '60',
                    viewCount: '100',
                }),
            }), 100))
        );

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        const initButton = screen.getByText('INITIALIZE');
        await user.click(initButton);

        expect(screen.getByText('SCANNING')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('SCANNING')).not.toBeInTheDocument();
        }, { timeout: 200 });
    });

    it('should show error message on fetch failure', async () => {
        const user = userEvent.setup();

        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'INVALID_SOURCE_URL' }),
        });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://invalid-url.com');

        const initButton = screen.getByText('INITIALIZE');
        await user.click(initButton);

        await waitFor(() => {
            expect(screen.getByText(/INVALID_SOURCE_URL/i)).toBeInTheDocument();
        });
    });

    it('should handle download execution', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Test Video',
            author: 'Test Author',
            thumbnail: 'thumb.jpg',
            quality: '1080p',
            lengthSeconds: '180',
            viewCount: '5000',
        };

        // Mock fetch for video info
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        // Mock fetch for download
        const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            headers: new Headers({
                'Content-Disposition': 'attachment; filename="Test Video.mp4"',
            }),
            blob: async () => mockBlob,
        });

        // Mock DOM methods for download
        const createElementSpy = vi.spyOn(document, 'createElement');
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

        render(<DownloadPage />);

        // Fetch video info
        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        const initButton = screen.getByText('INITIALIZE');
        await user.click(initButton);

        await waitFor(() => {
            expect(screen.getByText('EXECUTE_DOWNLOAD')).toBeInTheDocument();
        });

        // Execute download
        const downloadButton = screen.getByText('EXECUTE_DOWNLOAD');
        await user.click(downloadButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
            });
        });

        await waitFor(() => {
            expect(screen.getByText('EXTRACTION_COMPLETE')).toBeInTheDocument();
        });

        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalled();

        createElementSpy.mockRestore();
        createObjectURLSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
    });

    it('should show extracting state during download', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Test Video',
            author: 'Test Author',
            thumbnail: 'thumb.jpg',
            quality: '720p',
            lengthSeconds: '120',
            viewCount: '1000',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        (global.fetch as any).mockImplementationOnce(() =>
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                headers: new Headers({ 'Content-Disposition': 'attachment; filename="test.mp4"' }),
                blob: async () => new Blob(['data'], { type: 'video/mp4' }),
            }), 100))
        );

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        await user.click(screen.getByText('INITIALIZE'));

        await waitFor(() => {
            expect(screen.getByText('EXECUTE_DOWNLOAD')).toBeInTheDocument();
        });

        await user.click(screen.getByText('EXECUTE_DOWNLOAD'));

        expect(screen.getByText('EXTRACTING')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('EXTRACTING')).not.toBeInTheDocument();
        }, { timeout: 200 });
    });

    it('should format duration correctly', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Long Video',
            author: 'Test Author',
            thumbnail: 'thumb.jpg',
            quality: '720p',
            lengthSeconds: '3665', // 1 hour, 1 minute, 5 seconds
            viewCount: '10000',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        await user.click(screen.getByText('INITIALIZE'));

        await waitFor(() => {
            expect(screen.getByText('1:01:05')).toBeInTheDocument();
        });
    });

    it('should format view count correctly', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Popular Video',
            author: 'Test Author',
            thumbnail: 'thumb.jpg',
            quality: '1080p',
            lengthSeconds: '120',
            viewCount: '1500000', // 1.5M views
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123');

        await user.click(screen.getByText('INITIALIZE'));

        await waitFor(() => {
            expect(screen.getByText('1.5M')).toBeInTheDocument();
        });
    });

    it('should handle Enter key press', async () => {
        const user = userEvent.setup();
        const mockVideoInfo = {
            videoId: 'test123',
            title: 'Test Video',
            author: 'Test Author',
            thumbnail: 'thumb.jpg',
            quality: '720p',
            lengthSeconds: '60',
            viewCount: '100',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockVideoInfo,
        });

        render(<DownloadPage />);

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test123{Enter}');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    it('should display footer with status', () => {
        render(<DownloadPage />);

        expect(screen.getByText('YT_EXTRACT_SYSTEM © 2026')).toBeInTheDocument();
        expect(screen.getByText(/STATUS:/)).toBeInTheDocument();
    });

    it('should update backend status in footer', async () => {
        const user = userEvent.setup();

        (global.fetch as any).mockImplementationOnce(() =>
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                json: async () => ({
                    videoId: 'test',
                    title: 'Test',
                    author: 'Author',
                    thumbnail: 'thumb.jpg',
                    quality: '720p',
                    lengthSeconds: '60',
                    viewCount: '100',
                }),
            }), 50))
        );

        render(<DownloadPage />);

        expect(screen.getByText(/STATUS: READY/)).toBeInTheDocument();

        const input = screen.getByPlaceholderText('INPUT_SOURCE_URL');
        await user.type(input, 'https://www.youtube.com/watch?v=test');
        await user.click(screen.getByText('INITIALIZE'));

        expect(screen.getByText(/STATUS: ACTIVE/)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/STATUS: READY/)).toBeInTheDocument();
        }, { timeout: 200 });
    });
});
