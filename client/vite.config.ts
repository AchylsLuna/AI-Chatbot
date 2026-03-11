import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'csp-html-only',
    configureServer(server) {
      const devCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:5000 ws://localhost:5173; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      server.middlewares.use((req, res, next) => {
        try {
          // Always set safe, general headers for all responses
          res.setHeader('X-Frame-Options', 'DENY')
          res.setHeader('X-Content-Type-Options', 'nosniff')
          res.setHeader('Referrer-Policy', 'no-referrer')

          // Apply CSP only to HTML pages to avoid flagging static assets
          const accept = String(req.headers.accept || '')
          if (accept.includes('text/html')) {
            res.setHeader('Content-Security-Policy', devCsp)
          }
        } catch (err) {
          // best-effort, don't break dev server
        }
        next()
      })
    }
  }],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
  },
  esbuild: {
    legalComments: 'none',
  },
  preview: {
    headers: {
      // Stricter CSP for preview/prod-like scans.
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:5000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  },
})
