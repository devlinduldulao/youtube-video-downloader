import { describe, it, expect } from 'vitest';
import { cn } from './utils';

/**
 * Tests for the `cn` utility — a tiny but critical function used across
 * every component.  It merges Tailwind CSS classes using clsx (for
 * conditional logic) + tailwind-merge (to resolve conflicting utilities).
 *
 * Why test a one-liner?
 * Because it sits at the foundation of your styling layer.  A regression
 * here would silently break the look of the entire app.
 */
describe('cn utility', () => {
  // ── Basic merging ──────────────────────────────────────────────────────
  describe('basic class merging', () => {
    it('should merge multiple class strings', () => {
      // Arrange & Act
      const result = cn('text-red-500', 'bg-blue-500');

      // Assert — both classes should be present.
      expect(result).toBe('text-red-500 bg-blue-500');
    });

    it('should return empty string when no arguments are given', () => {
      expect(cn()).toBe('');
    });

    it('should handle a single class string', () => {
      expect(cn('p-4')).toBe('p-4');
    });
  });

  // ── Conditional classes (clsx behaviour) ───────────────────────────────
  describe('conditional classes', () => {
    it('should strip falsy values (false, null, undefined, 0, "")', () => {
      const result = cn('base-class', false && 'hidden', null, undefined, 0, '');

      // Only the truthy first class should survive.
      expect(result).toBe('base-class');
    });

    it('should include classes when conditions are truthy', () => {
      const isActive = true;
      const hasError = false;

      const result = cn(
        'btn',
        isActive && 'btn-active',
        hasError && 'btn-error',
      );

      expect(result).toBe('btn btn-active');
      expect(result).not.toContain('btn-error');
    });
  });

  // ── Tailwind-merge conflict resolution ─────────────────────────────────
  describe('tailwind-merge conflict resolution', () => {
    it('should resolve conflicting padding classes (last wins)', () => {
      // tailwind-merge knows that p-4 and p-2 are the same utility axis.
      const result = cn('p-4', 'p-2');
      expect(result).toBe('p-2');
    });

    it('should resolve conflicting text color classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should resolve conflicting background color classes', () => {
      const result = cn('bg-white', 'bg-black');
      expect(result).toBe('bg-black');
    });

    it('should keep non-conflicting classes untouched', () => {
      const result = cn('p-4', 'mt-2', 'text-lg');
      expect(result).toBe('p-4 mt-2 text-lg');
    });

    it('should merge axis-specific overrides (e.g. px overrides p)', () => {
      // px-2 overrides the horizontal portion of p-4.
      const result = cn('p-4', 'px-2');
      expect(result).toBe('p-4 px-2');
    });
  });

  // ── Array & object inputs ──────────────────────────────────────────────
  describe('array and object inputs', () => {
    it('should accept an array of classes', () => {
      const result = cn(['flex', 'items-center']);
      expect(result).toBe('flex items-center');
    });

    it('should accept an object where keys are classes and values are conditions', () => {
      const result = cn({
        'bg-red-500': true,
        'text-white': true,
        hidden: false,
      });

      expect(result).toContain('bg-red-500');
      expect(result).toContain('text-white');
      expect(result).not.toContain('hidden');
    });

    it('should handle mixed string, array, and object inputs', () => {
      const result = cn(
        'base',
        ['flex', 'gap-2'],
        { 'text-bold': true, 'sr-only': false },
      );

      expect(result).toContain('base');
      expect(result).toContain('flex');
      expect(result).toContain('gap-2');
      expect(result).toContain('text-bold');
      expect(result).not.toContain('sr-only');
    });
  });
});
