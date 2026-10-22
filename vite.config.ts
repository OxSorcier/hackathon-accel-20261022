import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist/client', emptyOutDir: true }, server: { proxy: { '/api': 'http://127.0.0.1:3000' }, fs: { strict: true, deny: ['.env', '.env.*', '**/.preparation/**', '**/operator/**', '**/proposals/**'] } } });
