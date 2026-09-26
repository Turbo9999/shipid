import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'pwa-512x512.png'],
      manifest: {
        name: 'TAIWAN NAVY',
        short_name: 'TAIWAN NAVY',
        description: 'Taiwan Navy Ship Identification Reference System',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
