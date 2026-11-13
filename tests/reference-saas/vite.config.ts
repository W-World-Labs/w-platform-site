import { defineConfig } from 'vite';
// Match the console's same-origin W-ID management ingress; OAuth stays direct.
const identityProxy = process.env.VITE_W_ID_URL ? {
    '^/api/workspaces/[^/]+/projects/[^/]+/keys(?:/|$)': {
        target: process.env.VITE_W_ID_URL,
        changeOrigin: true,
        timeout: 5_000,
        proxyTimeout: 5_000,
    },
} : undefined;
export default defineConfig({ root: new URL('.', import.meta.url).pathname, build: { outDir: '../../reference-saas-dist', emptyOutDir: true }, server: { host: '127.0.0.1', port: 4174, proxy: identityProxy }, preview: { host: '127.0.0.1', port: 4174, proxy: identityProxy } });
