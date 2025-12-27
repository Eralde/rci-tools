import {Connect, defineConfig, HttpProxy, loadEnv, ProxyOptions} from 'vite';
import {ClientRequest, ServerResponse} from 'node:http';
import {resolve} from 'path';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const projectRoot = __dirname;
  const env = loadEnv(mode, projectRoot, '');

  const devAddr = process.env.PROXY_ADDR // set by dev-runner.js
    || env.PROXY_ADDR; // fallback

  if (!devAddr) {
    console.error('Error: PROXY_ADDR is not defined. Please set it in .env or pass via --proxy-addr CLI argument.');
    process.exit(1);
  }

  const proxyAddr = devAddr.startsWith('http://')
    ? devAddr
    : `http://${devAddr}`;

  const proxyUrl = new URL(proxyAddr);

  // Path to the directory containing local packages in this monorepo.
  // This path needs to be accessible from Vite.
  const localPackagesParentDir = resolve(projectRoot, '../');

  const createProxy = (path: string): ProxyOptions => {
    return {
      target: proxyAddr,
      changeOrigin: true,
      configure: (proxy: HttpProxy.Server, _options: ProxyOptions): void => {
        proxy.on(
          'proxyReq',
          (
            proxyReq: ClientRequest,
            _req: Connect.IncomingMessage,
            _res: ServerResponse<Connect.IncomingMessage>,
          ): void => {
            proxyReq.setHeader('Host', proxyUrl.host);
            proxyReq.setHeader('Origin', proxyUrl.origin);
            console.log(`[Vite Proxy]: [${path}] Sending to ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
          },
        );

        proxy.on(
          'error',
          (
            err: Error,
            _req: Connect.IncomingMessage,
            _res: ServerResponse<Connect.IncomingMessage>,
          ): void => {
            console.error(`[Vite Proxy]: [${path}] Proxy Error:`, err);
          },
        );
      },
    }
  }

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
        '/rci': createProxy('/rci'),
        '/auth': createProxy('/auth'),
      },
    },
    build: {
      outDir: 'dist',
      // For vite-plugin-singlefile, base is usually './'
      base: './',
      emptyOutDir: true,
      minify: 'esbuild', // minify production build
      rollupOptions: {
        input: resolve(projectRoot, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@rci-tools/core': resolve(projectRoot, '../../packages/core/src/index.ts'),
      },
    },
    optimizeDeps: {
      include: [],
    },
  };
});
