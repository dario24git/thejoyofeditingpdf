import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

// ✅ RIGHE MANCANTI DA AGGIUNGERE
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: netlify(),
  vite: {
    resolve: {
      alias: {
        // Ora 'path' e '__dirname' sono definiti e funzionano
        '@components': path.resolve(__dirname, 'src/components'),
        '@lib': path.resolve(__dirname, 'src/lib'),
      }
    },
    server: {
      hmr: {
        timeout: 120000 // 2 minutes timeout instead of default 60 seconds
      }
    },
    optimizeDeps: {
      include: [
        'pdfjs-dist',
        'pdf-lib',
        '@supabase/supabase-js'
      ]
    }
  }
});