#!/usr/bin/env node
import {createServer} from 'vite';

const startDevServer = async (): Promise<void> => {
  try {
    const server = await createServer({
      // The configuration will be loaded from vite.config.mts automatically.
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
