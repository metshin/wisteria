import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from https://<user>.github.io/wisteria/
  base: '/wisteria/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, open: true },
  preview: { host: '127.0.0.1' },
  test: { environment: 'node', include: ['src/__tests__/**/*.test.ts'] },
});
