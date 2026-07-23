import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-react',  test: /node_modules\/(react|react-dom|react-router-dom|react-is)\// },
            { name: 'vendor-charts', test: /node_modules\/recharts\// },
            { name: 'vendor-pdf',    test: /node_modules\/(jspdf|html2canvas)\// },
            { name: 'vendor-xlsx',   test: /node_modules\/xlsx\// },
            { name: 'vendor-misc',   test: /node_modules\/(clsx|date-fns|react-hot-toast|zustand|lucide-react|nanoid)\// },
          ],
        },
      },
    },
  },
})
