import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Splits big, slow-changing dependencies into their own chunks,
        // separate from route code (now lazy-loaded per src/App.tsx) and
        // from app code (which changes on every deploy). Vendor code
        // rarely changes between releases, so a browser that's already
        // visited keeps reusing these cached chunks across deploys
        // instead of re-downloading everything every time something
        // ships — on top of the app's own JS no longer being one single
        // ~920KB file.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            // react-router (not just react-router-dom) and react-plaid-link
            // both import react-router-dom/react directly — grouping them
            // into the same chunk as react/react-dom avoids a chunk that
            // imports across the vendor/vendor-react split in both
            // directions, which Rollup flags as a circular chunk warning.
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-plaid-link') ||
            id.includes('node_modules/react/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@tabler')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/@sentry')) return 'vendor-sentry';
          return 'vendor';
        },
      },
    },
  },
})
