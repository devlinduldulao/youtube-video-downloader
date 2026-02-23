import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Automatically cleanup after each test (unmount rendered components)
afterEach(() => {
  cleanup();
});

// Mock next/image globally — Next.js <Image> uses internal optimization
// that doesn't work in jsdom. We replace it with a plain <img> tag.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    // Strip Next.js-only props that <img> doesn't understand
    const { fill: _fill, priority: _priority, ...rest } = props;
    // alt is spread through ...rest from the original Image props (required in next/image)
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// Mock next-themes — the actual provider requires browser APIs for storage.
// We provide a controllable mock so tests can simulate theme changes.
const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
    resolvedTheme: 'dark',
    themes: ['light', 'dark', 'dim'],
    systemTheme: 'dark',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Expose the mock so individual tests can assert on it
export { mockSetTheme };

// Mock framer-motion — animation library uses requestAnimationFrame
// and layout measurements that don't exist in jsdom.
// We replace animated components with plain HTML equivalents.
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
  useMotionValue: (initial: number) => ({ get: () => initial, set: vi.fn() }),
}));

// Mock sonner toast library — toasts require a portal and timers.
// We replace with spies so tests can verify toast calls.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn().mockReturnValue('toast-id'),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

// Stub window.URL.createObjectURL / revokeObjectURL since jsdom lacks blob URL support.
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-blob-url');
  window.URL.revokeObjectURL = vi.fn();
}
