import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./testing/setup.tsx'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'private'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['components/**', 'lib/**', 'app/api/**'],
      exclude: ['components/ui/**', '**/*.test.*', 'testing/**'],
    },
  },
});
