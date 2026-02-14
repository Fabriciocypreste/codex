import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
        mangle: {
          safari10: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            // Core — sempre carregado
            'vendor-react': ['react', 'react-dom'],
            // Router — carregado no boot
            'vendor-router': ['react-router-dom'],
            // Supabase — dados
            'vendor-supabase': ['@supabase/supabase-js'],
            // Player — HLS.js separado (só carrega ao abrir player)
            'vendor-player': ['hls.js'],
            // UI libs — framer-motion + lucide
            'vendor-ui': ['framer-motion', 'lucide-react'],
            // Recharts — admin only (TV Box nunca carrega)
            'vendor-charts': ['recharts'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
      // Comprimir melhor
      cssMinify: true,
      assetsInlineLimit: 4096,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
});
