import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { transformValueTypes } from 'motion';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
<<<<<<< HEAD
      host: '0.0.0.0',
=======
      host: true, 
>>>>>>> 4c21edb (committed)
      port: 3000,
      strictPort: true,
      cors: true,
      hmr: {
        overlay: false,
<<<<<<< HEAD
      },
=======
    },
>>>>>>> 4c21edb (committed)
    },
  };
});

