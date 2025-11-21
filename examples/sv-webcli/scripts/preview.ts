#!/usr/bin/env node
import {preview} from 'vite';

const startPreviewServer = async (): Promise<void> => {
  try {
    const server = await preview({
      // The configuration will be loaded from vite.config.mts automatically.
    });

    server.printUrls();
    console.log('\nPreview server is running.');
  } catch (e) {
    console.error('Failed to start Vite preview server:', e);
    process.exit(1);
  }
};

startPreviewServer();
