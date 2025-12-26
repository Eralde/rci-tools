import {Connect, defineConfig, HttpProxy, ProxyOptions} from 'vite';
import {ClientRequest, ServerResponse} from 'node:http';
import {resolve} from 'path';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {config as scriptConfig} from './scripts/args';

export default defineConfig(({mode}) => {
  const projectRoot = __dirname;

  // Path to the directory containing local packages in this monorepo.
  // This path needs to be accessible from Vite.
  const localPackagesParentDir = resolve(projectRoot, '../');

  const config = {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [svelte()],
    server: {
      port: 5174,
      strictPort: true,
      fs: {
        allow: [
          localPackagesParentDir,
        ],
      },
      proxy: {},
    },
    build: {
      outDir: 'dist',
      base: './',
      emptyOutDir: true,
      minify: 'esbuild', // minify production build
      rollupOptions: {
        input: resolve(projectRoot, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@rci-tools/base': resolve(projectRoot, '../../packages/base/src/index.ts'),
      },
    },
    optimizeDeps: {
      include: [],
    },
  };

  if (mode === 'development') {
    const devAddr = scriptConfig.deviceAddr as string;
    const httpPort = scriptConfig.httpPort;

    const prefix = devAddr.startsWith('http://')
      ? ''
      : 'http://';

    const proxyAddr = `${prefix}${devAddr}:${httpPort}`;
    const proxyUrl = new URL(proxyAddr);

    const createSimpleProxy = (websockets: boolean): ProxyOptions => {
      return {
        target: proxyAddr,
        ws: websockets,
        changeOrigin: true,
      };
    };

    const createApiProxy = (path: string): ProxyOptions => {
      return {
        target: proxyAddr,
        changeOrigin: true,
        // @ts-ignore
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
      };
    };

    // @ts-ignore
    config.server.proxy = {
      '/rci': createApiProxy('/rci'),
      '/ci': createApiProxy('/ci'),
      '/auth': createApiProxy('/auth'),

      '/spawn_ttyd': createSimpleProxy(false),
      '/kill_ttyd': createSimpleProxy(false),
      '/ws': createSimpleProxy(true),
    };
  }

  return config;
});
