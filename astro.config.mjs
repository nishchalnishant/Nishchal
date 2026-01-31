// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://nishchalnishant.github.io',
  base: '/Nishchal',
  vite: {
    plugins: [tailwindcss()]
  }
});