import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import { version } from './package.json'

/// <reference types="vitest" />

// CORS proxy plugin for browser dev mode
function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { url, method, headers, body: reqBody } = JSON.parse(body);
            const https = await import('https');
            const http = await import('http');
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            const startTime = Date.now();

            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || (isHttps ? 443 : 80),
              path: parsedUrl.pathname + parsedUrl.search,
              method: method,
              headers: headers || {},
              rejectUnauthorized: false,
            };

            const proxyReq = httpModule.request(options, (proxyRes) => {
              const chunks: Buffer[] = [];
              proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
              proxyRes.on('end', () => {
                const endTime = Date.now();
                const responseBody = Buffer.concat(chunks).toString('utf-8');
                const responseHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(proxyRes.headers)) {
                  responseHeaders[key] = Array.isArray(value) ? value.join(', ') : (value || '');
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: proxyRes.statusCode,
                  statusText: proxyRes.statusMessage,
                  headers: responseHeaders,
                  body: responseBody,
                  time: endTime - startTime,
                  size: Buffer.byteLength(responseBody, 'utf-8'),
                }));
              });
            });

            proxyReq.on('error', (error: any) => {
              const endTime = Date.now();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                status: 0,
                statusText: 'Network Error',
                headers: {},
                body: JSON.stringify({ error: error.message, code: error.code }),
                time: endTime - startTime,
                size: 0,
              }));
            });

            proxyReq.setTimeout(30000);
            if (reqBody) proxyReq.write(reqBody);
            proxyReq.end();
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      all: true,
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/types/**', 'src/components/sidebar/types.ts'],
      reporter: ['html', 'text-summary'],
      reportsDirectory: 'coverage',
    },
  },
})

