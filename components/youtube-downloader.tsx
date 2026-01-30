'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Download, Loader2, CheckCircle, AlertCircle, Video } from 'lucide-react';

export function YouTubeDownloader() {
    const [url, setUrl] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleDownload = async () => {
        if (!url.trim()) {
            setStatus('error');
            setMessage('Please enter a YouTube URL');
            return;
        }

        setIsDownloading(true);
        setStatus('idle');
        setMessage('');

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            const filename = filenameMatch ? filenameMatch[1] : 'video.mp4';

            // Create blob and download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            setStatus('success');
            setMessage('Video downloaded successfully!');
            setUrl('');
        } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'An error occurred');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isDownloading) {
            handleDownload();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800">
            <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-red-500 to-pink-600 shadow-2xl shadow-red-500/30 mb-4 animate-in zoom-in duration-500">
                        <Video className="w-10 h-10 text-white" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-neutral-900 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent">
                        YouTube Downloader
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
                        Download videos in the highest quality. Paste a YouTube link below to get started.
                    </p>
                </div>

                {/* Main Card */}
                <Card className="p-8 md:p-10 shadow-2xl border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label
                                htmlFor="youtube-url"
                                className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                            >
                                YouTube Video URL
                            </Label>
                            <div className="flex gap-3">
                                <Input
                                    id="youtube-url"
                                    type="url"
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={isDownloading}
                                    className="flex-1 h-12 text-base bg-neutral-50 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 transition-all"
                                />
                                <Button
                                    onClick={handleDownload}
                                    disabled={isDownloading || !url.trim()}
                                    size="lg"
                                    className="h-12 px-8 bg-linear-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5 mr-2" />
                                            Download
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {status !== 'idle' && (
                            <div
                                className={`flex items-start gap-3 p-4 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success'
                                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900'
                                        : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
                                    }`}
                            >
                                {status === 'success' ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                )}
                                <p
                                    className={`text-sm font-medium ${status === 'success'
                                            ? 'text-green-800 dark:text-green-200'
                                            : 'text-red-800 dark:text-red-200'
                                        }`}
                                >
                                    {message}
                                </p>
                            </div>
                        )}

                        {/* Info Section */}
                        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                                    <p>Videos are downloaded in the highest available quality</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                                    <p>Files are saved directly to your Downloads folder</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                                    <p>Supports all standard YouTube video URLs</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Footer */}
                <p className="text-center text-sm text-neutral-500 dark:text-neutral-500 animate-in fade-in duration-700 delay-300">
                    Download videos for offline viewing. Please respect copyright and terms of service.
                </p>
            </div>
        </div>
    );
}
