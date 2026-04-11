import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
    pool: 'forks'
  },
  resolve: {
    alias: {}
  }
});
