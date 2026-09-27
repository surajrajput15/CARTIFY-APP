import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    setupFiles: ['src/testSetup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/testSetup.js',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/main.jsx',
        'src/vite-env.d.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // F-49: explicit buckets for every heavy library so a map/charts/realtime
        // change never invalidates the react or app chunks. Anything unmapped
        // falls into a residual `vendor` bucket.
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // leaflet first — `react-leaflet` would otherwise match `react`.
            if (id.includes('leaflet')) return 'vendor-maps'
            if (id.includes('recharts') || /node_modules\/d3-/.test(id) || id.includes('victory')) return 'vendor-charts'
            if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket'
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('lucide-react') || id.includes('react-hot-toast')) {
              return 'vendor-ui'
            }
            if (id.includes('axios')) {
              return 'vendor-axios'
            }
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})