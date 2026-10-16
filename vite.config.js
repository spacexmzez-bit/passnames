import { defineConfig } from 'vite';
export default defineConfig({ publicDir: false, server: { proxy: { '/api': 'http://127.0.0.1:8787', '/parties': { target: 'ws://127.0.0.1:8787', ws: true } } } });
