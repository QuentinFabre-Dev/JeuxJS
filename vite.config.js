import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The browser calls `/ollama/...` and `/deepseek/...` on the app's own origin
// and Vite forwards them, so no CORS configuration is needed.
//
// The DeepSeek key is read here, in the Node process, and injected as a header
// on the way out. It is deliberately NOT prefixed `VITE_`: such variables are
// inlined into the bundle served to the browser, which would make the key
// public to anyone opening the devtools.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaTarget = env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const deepseekKey = env.DEEPSEEK_API_KEY;

  const proxies = {
    '/ollama': {
      target: ollamaTarget,
      changeOrigin: true,
      // Model generation is slow: never cut the stream short.
      timeout: 0,
      proxyTimeout: 0,
      rewrite: (path) => path.replace(/^\/ollama/, ''),
    },
    '/deepseek': {
      target: env.DEEPSEEK_HOST || 'https://api.deepseek.com',
      changeOrigin: true,
      timeout: 0,
      proxyTimeout: 0,
      rewrite: (path) => path.replace(/^\/deepseek/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (deepseekKey) {
            proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`);
          }
          // Without a key the request goes out unauthenticated and DeepSeek
          // answers 401, which the client turns into an explicit message.
        });
      },
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, host: true, proxy: proxies },
    // `npm run preview` serves the production build: keep the same proxies.
    preview: { proxy: proxies },
  };
});
