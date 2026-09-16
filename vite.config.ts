import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build can be served from any sub-path
  // (e.g. a hosted preview link), not just the domain root.
  base: './',
  plugins: [react()],
  test: {
    // The sim layer runs headless in Node — no browser, no rendering.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
