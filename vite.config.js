import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5175,
    strictPort: true, // 如果端口被占用，不要自动尝试下一个可用端口
  },
  build: {
    rollupOptions: {
      input: {
        main: 'src/popup/index.html'
      }
    },
    // 指定构建输出目录，默认为 'dist'
    // outDir: 'dist', 
  },
  root: 'src/popup',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
