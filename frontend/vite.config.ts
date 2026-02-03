import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Get allowed host from environment variable (passed via docker-compose)
  const allowedHost = process.env.VITE_ALLOWED_HOST || ''

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'favicon-32x32.png', 'favicon-16x16.png'],
        manifest: {
          name: 'FlexVerify Scanner',
          short_name: 'FlexVerify',
          description: 'Identity & Compliance Scanner',
          theme_color: '#8b5cf6',
          background_color: '#1f2937',
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
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        ...(allowedHost ? [allowedHost] : [])
      ],
      proxy: {
        '/api': {
          target: 'http://backend:8000',
          changeOrigin: true
        }
      }
    }
  }
})
