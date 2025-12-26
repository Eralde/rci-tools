const {defineConfig} = require('tsup');

module.exports = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {resolve: true},
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  minify: false,
});
