#!/usr/bin/env node
import {createServer} from 'vite';

const startDevServer = async (): Promise<void> => {
  try {
    const server = await createServer({
      configFile: 'vite.config.no-backend.mts',
    });

    await server.listen();

    server.printUrls();
    console.log('\nWatching for file changes...');
  } catch (e) {
    console.error('Failed to start Vite dev server:', e);
    process.exit(1);
  }
};

startDevServer();
