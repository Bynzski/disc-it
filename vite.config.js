import { defineConfig, loadEnv } from 'vite';

// `npm run dev` proxies the leaderboard API to `npm run server` (port 3000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    server: { proxy: { '/api': 'http://localhost:3000' } },
  };
});
