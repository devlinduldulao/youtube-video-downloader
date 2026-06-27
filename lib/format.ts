/**
 * Display-formatting helpers shared by the UI.
 *
 * These were previously defined inline inside DownloadPage, which made them
 * awkward to unit-test. Extracting them here keeps formatting logic separate
 * from rendering and lets us cover edge cases (NaN, huge values) directly.
 */

/**
 * Format a duration (given as a string of seconds) as "M:SS" or "H:MM:SS".
 *
 * Note: non-numeric input yields "NaN:NaN" — callers are expected to pass
 * yt-dlp's numeric `duration`, so we keep the behavior simple and documented
 * rather than masking bad input.
 */
export function formatDuration(seconds: string): string {
  const sec = parseInt(seconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a view count (given as a string) into a compact form:
 * 1500 -> "1.5K", 5_200_000 -> "5.2M". Values under 1000 are returned as-is.
 * Returns "0" when the input isn't numeric.
 */
export function formatViews(views: string): string {
  try {
    const num = parseInt(views);
    if (isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return views;
  } catch {
    return views;
  }
}
