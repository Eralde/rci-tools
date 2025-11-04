import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: false,
  target: 'node22',
  outDir: 'dist',
  tsconfig: './tsconfig.json',
  noExternal: [],
  external: [/node_modules/], // bundle everything except node_modules
});
