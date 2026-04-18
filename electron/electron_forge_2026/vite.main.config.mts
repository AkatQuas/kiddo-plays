import { extendsBaseConfig } from './vite.common.config.mts';

// https://vitejs.dev/config
export default extendsBaseConfig({
  build: {
    rollupOptions: {
      external: [],
    },
  },
});
