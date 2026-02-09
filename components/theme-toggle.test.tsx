import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';

/**
 * Tests for the ThemeToggle component.
 *
 * This component renders three buttons — Light, Dim, Dark — that call
 * `setTheme()` from next-themes.  We mock next-themes globally in
 * testing/setup.ts so we can inspect calls without needing real storage.
 *
 * Key concepts:
 * - **Accessibility queries** (`getByRole`, `getByTitle`) are preferred
 *   because they mirror how screen readers present UI to users.
 * - We use `userEvent` (not fireEvent) because it simulates real browser
 *   events more accurately (focus, pointer, click sequence).
 */

// Pull in the mock so we can clear / assert on it between tests.
let mockSetTheme: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Re-import the mock function fresh — it's created in setup.ts
  const setup = await import('../testing/setup');
  mockSetTheme = setup.mockSetTheme;
  mockSetTheme.mockClear();
});

describe('ThemeToggle', () => {
  // ── Rendering ────────────────────────────────────────────────────────
  describe('rendering', () => {
    it('should render three theme buttons', () => {
      render(<ThemeToggle />);

      // Each button has an accessible screen-reader label (sr-only).
      expect(screen.getByTitle('Light Mode')).toBeInTheDocument();
      expect(screen.getByTitle('Dim Mode')).toBeInTheDocument();
      expect(screen.getByTitle('Dark Mode')).toBeInTheDocument();
    });

    it('should contain screen-reader text for each mode', () => {
      render(<ThemeToggle />);

      // sr-only spans give assistive tech text even though they're hidden.
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dim')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });
  });

  // ── User interactions ────────────────────────────────────────────────
  describe('theme switching', () => {
    it('should call setTheme("light") when Light button is clicked', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.click(screen.getByTitle('Light Mode'));

      expect(mockSetTheme).toHaveBeenCalledWith('light');
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
    });

    it('should call setTheme("dim") when Dim button is clicked', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.click(screen.getByTitle('Dim Mode'));

      expect(mockSetTheme).toHaveBeenCalledWith('dim');
    });

    it('should call setTheme("dark") when Dark button is clicked', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.click(screen.getByTitle('Dark Mode'));

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });
});
