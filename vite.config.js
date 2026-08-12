import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The browser calls `/ollama/...` on the app's own origin and Vite forwards it
// to the local Ollama server, so no CORS configuration is needed.
// Override the target with OLLAMA_HOST in a .env file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaTarget = env.OLLAMA_HOST || 'http://127.0.0.1:11434';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/ollama': {
          target: ollamaTarget,
          changeOrigin: true,
          // Model generation is slow: never cut the stream short.
          timeout: 0,
          proxyTimeout: 0,
          rewrite: (path) => path.replace(/^\/ollama/, ''),
        },
      },
    },
    // `npm run preview` serves the production build: keep the same proxy.
    preview: {
      proxy: {
        '/ollama': {
          target: ollamaTarget,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
          rewrite: (path) => path.replace(/^\/ollama/, ''),
        },
      },
    },
  };
});
