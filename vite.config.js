import { defineConfig } from 'vite';

// `npm run dev` proxies the leaderboard API to `npm run server` (port 3000).
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
