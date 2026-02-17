import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      port: 5173,
      host: true,
      strictPort: false,
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
          drop_console: false,          // Não dropar tudo — preservar console.error
          drop_debugger: true,
          passes: 2,
          pure_funcs: [
            'console.log',
            'console.info',
            'console.debug',
            'console.warn',
            'console.time',
            'console.timeEnd',
            'console.timeLog',
            'console.trace',
            'console.count',
            'console.countReset',
            'console.group',
            'console.groupEnd',
            'console.groupCollapsed',
            'console.table',
            'console.dir',
            'console.dirxml',
            'console.profile',
            'console.profileEnd',
            'console.clear',
          ],
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
            // Player — (hls.js removido, usando ExoPlayer nativo)
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
