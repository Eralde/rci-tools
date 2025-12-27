import {Connect, ProxyOptions, defineConfig, loadEnv} from 'vite';
import {ClientRequest, ServerResponse} from 'node:http';
import {resolve} from 'path';
import {viteSingleFile} from 'vite-plugin-singlefile';

type HttpProxyServer = Parameters<NonNullable<ProxyOptions['configure']>>[0];

export default defineConfig(({mode, command}) => {
  const projectRoot = __dirname;
  const env = loadEnv(mode, projectRoot, '');

  // required only for dev server, not for build
  const devAddr = process.env.PROXY_ADDR // set by dev-runner.js
    || env.PROXY_ADDR; // fallback

  if (command === 'serve' && !devAddr) {
    // dprint-ignore
    console.error('Error: PROXY_ADDR is not defined. Please set it in the .env file or pass via --proxy-addr CLI argument.');
    process.exit(1);
  }

  let proxyAddr: string | undefined = undefined

  if (devAddr) {
    proxyAddr = devAddr?.startsWith('http://')
      ? devAddr
      : `http://${devAddr}`;
  }

  const proxyUrl = proxyAddr ? new URL(proxyAddr) : undefined;

  // Path to the directory containing local packages in this monorepo.
  // This path needs to be accessible from Vite.
  const localPackagesParentDir = resolve(projectRoot, '../');

  const createProxy = (path: string): ProxyOptions => {
    if (!proxyAddr || !proxyUrl) {
      throw new Error('proxyAddr and proxyUrl must be defined when creating proxy');
    }

    return {
      target: proxyAddr,
      changeOrigin: true,
      configure: (proxy: HttpProxyServer, _options: ProxyOptions): void => {
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
      proxy: proxyAddr
        ? {
          '/rci': createProxy('/rci'),
          '/auth': createProxy('/auth'),
        }
        : undefined,
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
