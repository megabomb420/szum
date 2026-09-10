import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://megabomb420.github.io',
  base: '/szum',
  output: 'static',
  integrations: [react()],
});
