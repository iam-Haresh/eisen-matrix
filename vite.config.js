import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' makes the production build use relative paths, so the built
// dist/index.html can be opened directly (file://) or served from any subpath.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // In dev, forward /api calls to the companion file-persistence server
    // (server.mjs) so the app can read/write the JSON file with live reload.
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 4317}`,
    },
  },
})
