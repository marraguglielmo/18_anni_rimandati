import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // mai inline degli asset: pixel art servita com'è
  },
});
