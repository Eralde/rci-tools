import {defineConfig, loadEnv} from 'vite';
import {resolve} from 'path';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const projectRoot = __dirname;
  const env = loadEnv(mode, projectRoot, '');

  const proxyAddr = env.PROXY_ADDR;
  const proxyUrl = new URL(proxyAddr);

  // Path to the directory containing local packages in this monorepo.
  // This path needs to be accessible from Vite.
  const localPackagesParentDir = resolve(projectRoot, '../');

  return {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [viteSingleFile()],
    server: {
      port: 5174,
      strictPort: true,
      fs: {
        allow: [
          localPackagesParentDir,
        ],
      },
      proxy: {
        '/rci': {
          target: proxyAddr,
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('Host', proxyUrl.host);
              proxyReq.setHeader('Origin', proxyUrl.origin);
              console.log(`[Vite Proxy]: [/rci/] Sending to ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
            });
            proxy.on('error', (err, _req, _res) => {
              console.error('[Vite Proxy]: [/rci/] Proxy Error:', err);
            });
          },
        },
        '/auth': {
          target: proxyAddr,
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('Host', proxyUrl.host);
              proxyReq.setHeader('Origin', proxyUrl.origin);
              console.log(`[Vite Proxy]: [/auth/] Sending to ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
            });
            proxy.on('error', (err, _req, _res) => {
              console.error('[Vite Proxy]: [/auth/] Proxy Error:', err);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      // For vite-plugin-singlefile, base is usually './'
      base: './',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(projectRoot, 'index.html'),
      },
    },
    resolve: {
      alias: {
        'rci-manager': resolve(projectRoot, '../../packages/rci-manager/src/index.ts'),
      },
    },
    optimizeDeps: {
      include: [],
    },
  };
});
