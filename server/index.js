import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
const db = openDb(process.env.DB_PATH || path.join(root, 'data', 'scores.db'));
const app = createApp({ db, staticDir: path.join(root, 'dist') });
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`Disc It server on http://localhost:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
