import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The sim layer runs headless in Node — no browser, no rendering.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
