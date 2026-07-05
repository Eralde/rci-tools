import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/core/__tests__/rci.manager.execute.test.ts',
      'packages/core/__tests__/rci-manager/rci.background-process.test.ts',
      'packages/core/__tests__/rci-manager/helpers/rci-response.helper.integration.test.ts',
    ],
  },
});
