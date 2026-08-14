import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Set VITE_BASE_PATH=/<repo-name>/ when deploying to GitHub Pages from a
  // project page. Firebase Hosting serves from the root, so '/' is the default.
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    // Players open this on whatever phone they own, and a browser too old for
    // the emitted syntax fails with a blank page rather than a message. Vite's
    // default target assumes Safari 16 / Chrome 107; these are the oldest
    // versions that still support the ES modules this build ships as.
    target: ['es2019', 'safari13', 'chrome64', 'firefox67', 'edge79'],
    rollupOptions: {
      output: {
        // Keep the Firebase SDK in its own chunk so the app shell paints fast
        // on a phone with one bar of signal.
        manualChunks: { firebase: ['firebase/app', 'firebase/database', 'firebase/auth'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
