import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Set VITE_BASE_PATH=/<repo-name>/ when deploying to GitHub Pages from a
  // project page. Firebase Hosting serves from the root, so '/' is the default.
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Keep the Firebase SDK in its own chunk so the app shell paints fast
        // on a phone with one bar of signal.
        manualChunks: { firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
