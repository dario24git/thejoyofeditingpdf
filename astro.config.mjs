import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: netlify(),
  vite: {
    resolve: {
      alias: {
        // Definisci gli stessi alias che hai in tsconfig.json
        '@components': path.resolve(__dirname, 'src/components'),
        '@lib': path.resolve(__dirname, 'src/lib'),
      }
    },
    server: {
      hmr: {
        timeout: 120000 // 2 minutes timeout instead of default 60 seconds
      }
    }
  }
});