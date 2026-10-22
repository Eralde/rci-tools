import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // integration tests need a device; run them via `pnpm test -- --addr <device-ip>` in packages/core
      'packages/core/__tests__/integration/**',
    ],
  },
});
