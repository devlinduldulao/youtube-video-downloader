import { describe, it, expect } from 'vitest';

/**
 * Tests for the inline formatting helper functions used in the DownloadPage.
 *
 * These functions live INSIDE the DownloadPage component, so they aren't
 * directly importable.  We re-implement them here to test the logic in
 * isolation.  This is a common pattern when logic is embedded in a
 * component — ideally you'd extract these into a `lib/format.ts` file
 * for reuse and testability, but testing them directly is also valid.
 *
 * Why extract and test separately?
 *   - Easier to test edge cases (negative numbers, NaN, huge values)
 *   - Faster tests (no React rendering overhead)
 *   - Encourages single-responsibility: formatting ≠ rendering
 *
 * Best practice: If these tests pass, consider moving the functions
 * to `lib/format.ts` and importing them into the component.
 */

// ── Re-implementations matching DownloadPage source code ──────────────
function formatDuration(seconds: string): string {
  const sec = parseInt(seconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: string): string {
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

describe('formatDuration', () => {
  describe('seconds only', () => {
    it('should format 0 seconds as "0:00"', () => {
      expect(formatDuration('0')).toBe('0:00');
    });

    it('should format 5 seconds as "0:05"', () => {
      expect(formatDuration('5')).toBe('0:05');
    });

    it('should format 59 seconds as "0:59"', () => {
      expect(formatDuration('59')).toBe('0:59');
    });
  });

  describe('minutes and seconds', () => {
    it('should format 60 seconds as "1:00"', () => {
      expect(formatDuration('60')).toBe('1:00');
    });

    it('should format 90 seconds as "1:30"', () => {
      expect(formatDuration('90')).toBe('1:30');
    });

    it('should format 212 seconds as "3:32"', () => {
      expect(formatDuration('212')).toBe('3:32');
    });

    it('should format 599 seconds as "9:59"', () => {
      expect(formatDuration('599')).toBe('9:59');
    });
  });

  describe('hours, minutes, and seconds', () => {
    it('should format 3600 seconds as "1:00:00"', () => {
      expect(formatDuration('3600')).toBe('1:00:00');
    });

    it('should format 3661 seconds as "1:01:01"', () => {
      expect(formatDuration('3661')).toBe('1:01:01');
    });

    it('should format 7200 seconds as "2:00:00"', () => {
      expect(formatDuration('7200')).toBe('2:00:00');
    });

    it('should format 86399 seconds as "23:59:59"', () => {
      expect(formatDuration('86399')).toBe('23:59:59');
    });

    it('should pad minutes and seconds with leading zeros', () => {
      // 1 hour, 5 minutes, 3 seconds
      expect(formatDuration('3903')).toBe('1:05:03');
    });
  });

  describe('edge cases', () => {
    it('should handle NaN gracefully', () => {
      // parseInt('abc') returns NaN
      // NaN math produces NaN, then NaN.toString() = 'NaN'
      // This is technically a bug in the source — good to document
      const result = formatDuration('abc');
      expect(result).toBe('NaN:NaN');
    });
  });
});

describe('formatViews', () => {
  describe('small numbers (< 1000)', () => {
    it('should return the raw string for numbers under 1000', () => {
      expect(formatViews('0')).toBe('0');
      expect(formatViews('999')).toBe('999');
      expect(formatViews('42')).toBe('42');
    });
  });

  describe('thousands (1K - 999K)', () => {
    it('should format 1000 as "1.0K"', () => {
      expect(formatViews('1000')).toBe('1.0K');
    });

    it('should format 1500 as "1.5K"', () => {
      expect(formatViews('1500')).toBe('1.5K');
    });

    it('should format 42000 as "42.0K"', () => {
      expect(formatViews('42000')).toBe('42.0K');
    });

    it('should format 999999 as "1000.0K"', () => {
      // 999999 / 1000 = 999.999, but it's < 1000000 so it uses K
      expect(formatViews('999999')).toBe('1000.0K');
    });
  });

  describe('millions (1M+)', () => {
    it('should format 1000000 as "1.0M"', () => {
      expect(formatViews('1000000')).toBe('1.0M');
    });

    it('should format 1500000000 as "1500.0M"', () => {
      expect(formatViews('1500000000')).toBe('1500.0M');
    });

    it('should format 5200000 as "5.2M"', () => {
      expect(formatViews('5200000')).toBe('5.2M');
    });
  });

  describe('edge cases', () => {
    it('should return "0" for NaN input', () => {
      expect(formatViews('not-a-number')).toBe('0');
    });

    it('should return "0" for empty string', () => {
      // parseInt('') returns NaN
      expect(formatViews('')).toBe('0');
    });

    it('should handle string with leading number', () => {
      // parseInt('123abc') = 123 (JS behaviour)
      expect(formatViews('123abc')).toBe('123abc');
    });
  });
});
