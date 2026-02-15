'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, ArrowRight, Box, Download, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';

interface VideoInfo {
    videoId: string;
    title: string;
    author: string;
    thumbnail: string;
    quality: string;
    lengthSeconds: string;
    viewCount: string;
}

interface DownloadStatus {
    filename: string;
    path: string;
    quality: string;
}

/**
 * Progress data received via SSE from the /api/download-progress endpoint.
 *
 * ## Phases
 * - `initializing`: Fetching video metadata with yt-dlp --get-title
 * - `downloading_video`: Downloading the video stream (0–75% overall)
 * - `downloading_audio`: Downloading the audio stream (75–90% overall)
 * - `merging`: FFmpeg merging video + audio into a single MP4 (90–98%)
 * - `complete`: File is ready for download
 * - `error`: Something went wrong
 *
 * ## Why overallPercent?
 * yt-dlp downloads video and audio as separate streams, each going 0–100%.
 * `overallPercent` maps both into a single 0–100% range so the progress
 * bar never goes backwards — much better UX.
 */
interface DownloadProgress {
    phase: 'initializing' | 'downloading_video' | 'downloading_audio' | 'merging' | 'complete' | 'error';
    percent: number;
    overallPercent: number;
    speed: string | null;
    eta: string | null;
    totalSize: string | null;
    message: string;
}

export function DownloadPage() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);

    // AbortController ref lets us cancel the SSE stream if the user
    // navigates away or clicks cancel
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleFetchInfo = async () => {
        if (!url.trim()) return;

        setLoading(true);
        setError(null);
        setVideoInfo(null);
        setDownloadStatus(null);

        try {
            const response = await fetch('/api/video-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'TARGET_UNREACHABLE');
            }

            const data = await response.json();
            setVideoInfo(data);
        } catch (err) {
            setError(err instanceof Error ? `ERROR: ${err.message}` : 'CONNECTION_REFUSED: TARGET_LOCKED');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Trigger the browser's native file download using an invisible <a> tag.
     *
     * Why an <a> tag instead of window.location?
     * - The `download` attribute suggests a filename to the browser
     * - It doesn't navigate away from the page
     * - Works with the /api/download-file endpoint that returns the binary file
     */
    const triggerFileDownload = useCallback((downloadId: string, filename: string) => {
        const a = document.createElement('a');
        a.href = `/api/download-file?id=${encodeURIComponent(downloadId)}`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, []);

    /**
     * Parse SSE (Server-Sent Events) text into structured events.
     *
     * SSE format:
     *   event: progress\n
     *   data: {"percent": 45.2, ...}\n
     *   \n
     *
     * The double newline (\n\n) marks the end of an event.
     * We accumulate text in a buffer because reader.read() chunks
     * don't necessarily align with event boundaries.
     */
    const parseSseEvents = useCallback((text: string): Array<{ type: string; data: string }> => {
        const events: Array<{ type: string; data: string }> = [];
        const rawEvents = text.split('\n\n');

        for (const rawEvent of rawEvents) {
            if (!rawEvent.trim()) continue;

            const lines = rawEvent.split('\n');
            let eventType = '';
            let eventData = '';

            for (const line of lines) {
                if (line.startsWith('event: ')) eventType = line.slice(7);
                if (line.startsWith('data: ')) eventData = line.slice(6);
            }

            if (eventType && eventData) {
                events.push({ type: eventType, data: eventData });
            }
        }

        return events;
    }, []);

    const executeDownload = async () => {
        if (!url.trim()) return;

        setDownloading(true);
        setError(null);
        setDownloadStatus(null);
        setProgress(null);

        // Create an AbortController so we can cancel if needed
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const toastId = toast.loading('Initiating extraction protocol...');

        try {
            /**
             * Instead of calling /api/download (which gives no progress),
             * we call /api/download-progress which returns an SSE stream.
             * Each event contains real-time progress data from yt-dlp.
             */
            const response = await fetch('/api/download-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'DOWNLOAD_FAILED');
            }

            // Read the SSE stream using the Streams API
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append new data to buffer and process complete events
                buffer += decoder.decode(value, { stream: true });

                // Split on double newline (SSE event delimiter)
                const parts = buffer.split('\n\n');
                // Last part may be incomplete — keep it in the buffer
                buffer = parts.pop() || '';

                const events = parseSseEvents(parts.join('\n\n'));

                for (const event of events) {
                    if (event.type === 'progress') {
                        const data = JSON.parse(event.data) as DownloadProgress;
                        setProgress(data);

                        // Update toast with current phase
                        toast.loading(data.message, { id: toastId });
                    } else if (event.type === 'complete') {
                        const data = JSON.parse(event.data) as {
                            downloadId: string;
                            filename: string;
                            fileSize: number;
                            fileSizeMB: string;
                        };

                        // Trigger the actual file download via the browser
                        triggerFileDownload(data.downloadId, data.filename);

                        setDownloadStatus({
                            filename: data.filename,
                            path: 'System Downloads Folder',
                            quality: videoInfo?.quality || 'High',
                        });

                        toast.success('Extraction complete!', {
                            id: toastId,
                            description: `${data.filename} (${data.fileSizeMB}) saved to downloads.`,
                        });
                    } else if (event.type === 'error') {
                        const data = JSON.parse(event.data) as { message: string };
                        throw new Error(data.message);
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                toast.info('Download cancelled.', { id: toastId });
            } else {
                const errorMsg = err instanceof Error ? `DOWNLOAD_ERROR: ${err.message}` : 'EXTRACTION_FAILED';
                setError(errorMsg);
                toast.error(errorMsg, { id: toastId });
            }
        } finally {
            setDownloading(false);
            setProgress(null);
            abortControllerRef.current = null;
        }
    };

    const formatDuration = (seconds: string) => {
        const sec = parseInt(seconds);
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec % 3600) / 60);
        const secs = sec % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatViews = (views: string) => {
        try {
            const num = parseInt(views);
            if (isNaN(num)) return '0';
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
            return views;
        } catch {
            return views;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-mono selection:bg-[var(--color-brand-lime)] selection:text-black overflow-hidden relative transition-colors duration-300">
            {/* Background Grid */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-20 transition-opacity duration-300"
                style={{
                    backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    color: 'var(--foreground)'
                }}
            />

            {/* Decorative Elements */}
            <div className="fixed top-0 left-0 w-64 h-64 bg-[var(--color-brand-lime)] rounded-full blur-[150px] opacity-10 pointer-events-none" />
            <div className="fixed bottom-0 right-0 w-96 h-96 bg-[var(--color-brand-lime)] rounded-full blur-[200px] opacity-5 pointer-events-none" />

            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            <main className="relative z-10 container mx-auto px-4 py-20 max-w-5xl">

                {/* Header Section */}
                <header className="mb-24 relative">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-2 h-2 bg-[var(--color-brand-lime)] animate-pulse" />
                            <span className="text-xs tracking-[0.2em] text-muted-foreground">SYSTEM_READY</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 relative inline-block font-display">
                            YT_EXTRACT
                            <span className="text-[var(--color-brand-lime)] text-lg absolute -top-4 -right-8 font-mono">v.2.0</span>
                        </h1>

                        <p className="max-w-xl text-muted-foreground text-lg leading-relaxed border-l-2 border-[var(--color-brand-lime)]/30 pl-6">
                            Advanced protocol for media extraction. Direct download to local storage.
                            High-fidelity MP4 assets acquired automatically.
                        </p>
                    </motion.div>
                </header>

                {/* Input Interface */}
                <section className="relative mb-20">
                    <div className="absolute -inset-1 bg-linear-to-r from-[var(--color-brand-lime)] to-transparent opacity-20 blur-lg rounded-none" />
                    <div className="relative bg-card border border-border p-1 flex items-center transition-colors duration-300">

                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                <Box className="w-5 h-5 text-muted-foreground group-focus-within:text-[var(--color-brand-lime)] transition-colors" />
                            </div>
                            <Input
                                type="text"
                                placeholder="INPUT_SOURCE_URL"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleFetchInfo()}
                                className="w-full h-20 bg-transparent border-none text-2xl pl-16 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 rounded-none font-display font-light"
                            />
                        </div>

                        <Button
                            onClick={handleFetchInfo}
                            disabled={loading || !url}
                            className={cn(
                                "h-20 px-10 text-lg font-bold uppercase tracking-wider transition-all duration-300 rounded-none",
                                "bg-[var(--color-brand-lime)] text-black hover:opacity-90 hover:scale-[0.98]",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin text-xl">❋</span>
                                    SCANNING
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    INITIALIZE
                                    <ArrowRight className="w-5 h-5" />
                                </span>
                            )}
                        </Button>
                    </div>

                    {/* Error Display */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 bg-destructive/10 border-l-2 border-destructive text-destructive p-4 font-mono text-sm flex items-center gap-3"
                            >
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Success Display */}
                    <AnimatePresence>
                        {downloadStatus && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 bg-[var(--color-brand-lime)]/10 border-l-2 border-[var(--color-brand-lime)] text-[var(--color-brand-lime)] p-4 font-mono text-sm"
                            >
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                                    <div className="space-y-1">
                                        <div className="font-bold">EXTRACTION_COMPLETE</div>
                                        <div className="text-foreground/70 text-xs">
                                            FILE: {downloadStatus.filename}
                                        </div>
                                        <div className="text-foreground/70 text-xs">
                                            PATH: {downloadStatus.path}
                                        </div>
                                        <div className="text-foreground/70 text-xs">
                                            QUALITY: {downloadStatus.quality}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Video Results Area */}
                <AnimatePresence mode="wait">
                    {videoInfo && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-12"
                        >
                            {/* Preview Unit */}
                            <div className="lg:col-span-7 group cursor-pointer relative">
                                <div className="absolute -inset-2 bg-[var(--color-brand-lime)] opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                                <div className="relative border border-border bg-card overflow-hidden aspect-video transition-colors duration-300">
                                    {/* Decorative corner markers */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--color-brand-lime)] z-20" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--color-brand-lime)] z-20" />

                                    <Image
                                        src={videoInfo.thumbnail}
                                        alt="Target Preview"
                                        fill
                                        className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = `https://img.youtube.com/vi/${videoInfo.videoId}/hqdefault.jpg`;
                                        }}
                                    />

                                    <div className="absolute inset-0 bg-linear-to-t from-background/90 via-transparent to-transparent flex items-end p-8">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 bg-[var(--color-brand-lime)] text-black text-[10px] font-bold uppercase">Target_Acquired</span>
                                            </div>
                                            <h2 className="text-3xl font-bold font-display leading-tight mb-2 line-clamp-2 text-foreground">
                                                {videoInfo.title}
                                            </h2>
                                            <p className="text-muted-foreground font-mono text-sm">
                                                AUTHOR: {videoInfo.author.toUpperCase()} // ID: {videoInfo.videoId}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Control Unit */}
                            <div className="lg:col-span-5 flex flex-col justify-end">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                        <span className="text-xs text-muted-foreground tracking-widest">TARGET_METADATA</span>
                                        <span className="text-xs text-[var(--color-brand-lime)] animate-pulse">■ LOCKED</span>
                                    </div>

                                    {/* Metadata Display */}
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center border-l-2 border-border pl-4 py-2 transition-colors duration-300">
                                            <span className="text-muted-foreground">DURATION</span>
                                            <span className="text-[var(--color-brand-lime)] font-bold">{formatDuration(videoInfo.lengthSeconds)}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-l-2 border-border pl-4 py-2 transition-colors duration-300">
                                            <span className="text-muted-foreground">VIEWS</span>
                                            <span className="text-[var(--color-brand-lime)] font-bold">{formatViews(videoInfo.viewCount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-l-2 border-border pl-4 py-2 transition-colors duration-300">
                                            <span className="text-muted-foreground">QUALITY</span>
                                            <span className="text-[var(--color-brand-lime)] font-bold">{videoInfo.quality}</span>
                                        </div>
                                    </div>

                                    {/* Execute Download Button */}
                                    <div className="pt-6">
                                        <Button
                                            onClick={executeDownload}
                                            disabled={downloading}
                                            className={cn(
                                                "w-full h-16 text-lg font-black uppercase tracking-widest transition-all duration-300 rounded-none relative overflow-hidden group",
                                                "bg-[var(--color-brand-lime)] text-black hover:opacity-90",
                                                "disabled:opacity-50 disabled:cursor-not-allowed"
                                            )}
                                        >
                                            {downloading ? (
                                                <span className="flex items-center justify-center gap-3">
                                                    <span className="animate-spin text-2xl">❋</span>
                                                    EXTRACTING
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-3">
                                                    <Download className="w-5 h-5 group-hover:animate-bounce" />
                                                    EXECUTE_DOWNLOAD
                                                </span>
                                            )}

                                            {/* Button glow effect */}
                                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-20 bg-[linear-gradient(45deg,transparent,white,transparent)] bg-size-[200%_200%] animate-[shimmer_2s_infinite]" />
                                        </Button>
                                    </div>

                                    {/* ── Download Progress Section ────────────────── */}
                                    <AnimatePresence>
                                        {downloading && progress && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                                className="space-y-4 pt-2 overflow-hidden"
                                            >
                                                {/* Phase label + percentage */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 bg-[var(--color-brand-lime)] animate-pulse" />
                                                        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                                                            {progress.phase === 'initializing' && 'INITIALIZING_PROTOCOL'}
                                                            {progress.phase === 'downloading_video' && 'EXTRACTING_VIDEO'}
                                                            {progress.phase === 'downloading_audio' && 'EXTRACTING_AUDIO'}
                                                            {progress.phase === 'merging' && 'MERGING_STREAMS'}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-bold text-[var(--color-brand-lime)] font-mono tabular-nums">
                                                        {progress.overallPercent}%
                                                    </span>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="h-1.5 bg-border/30 overflow-hidden relative">
                                                    <motion.div
                                                        className="h-full bg-[var(--color-brand-lime)]"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress.overallPercent}%` }}
                                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                                    />
                                                    {/* Animated scanline effect over the bar */}
                                                    <div
                                                        className="absolute inset-0 opacity-30"
                                                        style={{
                                                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite linear',
                                                        }}
                                                    />
                                                </div>

                                                {/* Stats row */}
                                                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                                                    <div className="border-l-2 border-border pl-3 py-1 transition-colors duration-300">
                                                        <span className="text-muted-foreground block tracking-widest">SPEED</span>
                                                        <span className="text-[var(--color-brand-lime)] font-bold">
                                                            {progress.speed || '—'}
                                                        </span>
                                                    </div>
                                                    <div className="border-l-2 border-border pl-3 py-1 transition-colors duration-300">
                                                        <span className="text-muted-foreground block tracking-widest">ETA</span>
                                                        <span className="text-[var(--color-brand-lime)] font-bold">
                                                            {progress.eta || '—'}
                                                        </span>
                                                    </div>
                                                    <div className="border-l-2 border-border pl-3 py-1 transition-colors duration-300">
                                                        <span className="text-muted-foreground block tracking-widest">SIZE</span>
                                                        <span className="text-[var(--color-brand-lime)] font-bold">
                                                            {progress.totalSize || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="pt-4 border-t border-border">
                                        <p className="text-[10px] text-muted-foreground leading-relaxed font-mono">
                                            NOTICE: File will be saved to your system&apos;s Downloads directory.
                                            Extraction uses highest available quality.
                                            Process may take 30-120 seconds depending on file size.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>

            {/* Footer / Status Bar */}
            <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-sm py-2 px-6 transition-colors duration-300">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground tracking-wider">
                    <div>
                        <span>STATUS: {downloading && progress ? progress.message : loading || downloading ? 'ACTIVE' : 'READY'}</span>
                    </div>
                    <div>
                        YT_EXTRACT_SYSTEM © 2026
                    </div>
                </div>
            </footer>
        </div>
    );
}
