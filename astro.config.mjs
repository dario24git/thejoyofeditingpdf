import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: netlify(),
  vite: {
    server: {
      hmr: {
        timeout: 120000 // 2 minutes timeout instead of default 60 seconds
      }
    }
  }
});