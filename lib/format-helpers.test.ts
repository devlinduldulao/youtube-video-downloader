import { describe, it, expect } from 'vitest';
import { formatDuration, formatViews } from './format';

/**
 * Tests for the shared formatting helpers used in the DownloadPage.
 *
 * These functions were extracted from the component into `lib/format.ts`
 * so they can be imported and tested in isolation — no React rendering
 * overhead, and edge cases (NaN, huge values) are easy to cover.
 */

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
