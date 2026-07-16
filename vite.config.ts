import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPackageNameFromNodeModuleId(id: string) {
  const normalizedId = id.replace(/\\/g, '/')
  const packageSegments = normalizedId.split('/node_modules/')[1]?.split('/') ?? []

  if (packageSegments[0]?.startsWith('@')) {
    return `${packageSegments[0]}/${packageSegments[1] ?? ''}`
  }

  return packageSegments[0] ?? ''
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) {
            return undefined
          }

          const packageName = getPackageNameFromNodeModuleId(id)

          if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
            return 'react-vendor'
          }

          return undefined
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4001',
    },
  },
})
