import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { extendsBaseConfig } from './vite.common.config.mts';

// https://vitejs.dev/config
export default extendsBaseConfig({
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        lite: './lite.html',
      },
    },
  },
});
