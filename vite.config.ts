/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Libraries in their own files, apart from the app's code, so an app update doesn't make returning
  // visitors re-download them. Named explicitly: the spreadsheet library must stay loaded on demand.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /[\\/]node_modules[\\/]react-router[\\/]/ },
            { name: 'supabase', test: /[\\/]node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/ },
          ],
        },
      },
    },
  },
  // Integration tests hit the local Supabase stack, so they only run when asked for.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: process.env.INTEGRATION ? ['src/**/*.integration.test.ts'] : ['src/**/*.test.{ts,tsx}'],
    exclude: process.env.INTEGRATION ? [] : ['src/**/*.integration.test.ts'],
  },
})
