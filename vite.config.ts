import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~@': resolve(__dirname, 'src'),
      'cornerstone-nifti-image-loader':
        '@cornerstonejs/nifti-image-loader/dist/cornerstoneNIFTIImageLoader.min.js',
    },
  },
  base: './',
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
