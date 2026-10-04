# Disc It

A playable browser-based 3D disc golf game built with Three.js and Vite.

Play Tocobaga Nine: an original, Florida city-park-inspired nine-hole course with doglegs, wooded fairways, protected greens, water carries, and a par-32 round scorecard. Includes three disc types, bank-driven arcade flight, and skippable hole previews.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

## Controls

- Click the course to capture the mouse; move the mouse to aim.
- Hold and release the left mouse button to throw. Power oscillates while held.
- Scroll up for hyzer (left finish, RHBH); scroll down for anhyzer (right).
- **1 / 2 / 3:** driver / midrange / putter.
- **V:** elevated inspection view / first-person view.
- **R:** restart the current hole.
- **N:** next hole after finishing; new round after hole 9.
- **Esc:** release the mouse cursor.
- **Space / Enter / Esc / click:** skip the hole preview.

Water landings cost one penalty stroke and return to the previous lie.

## Leaderboard

The title screen has a **Leaderboard run** toggle. In a run, restarting and replaying holes is disabled; finishing the round posts your score to a shared board, kept separately per course and round format (Front 9, Back 9, All 18). **Free play** is unchanged and never posts. Your name and personal bests are remembered in the browser. The top 10 for the selected course and format is shown on the title screen.

A small Express + SQLite server stores the scores (light validation only: no accounts, so it is not tamper-proof).

```sh
npm run build && npm run server   # serves the game and the API on PORT (default 3000)
npm run dev                       # development: run `npm run server` too; Vite proxies /api to port 3000
```

- Scores live in `data/scores.db` (override with `DB_PATH`). While the server is running, back up with SQLite's online backup API; copying only the main file can omit committed WAL data. The VPS runbook includes the tested backup helper.
- Put your usual reverse proxy in front and forward everything to the Node port, passing `X-Forwarded-For` so the rate limit (about 5 posts a minute per IP) sees real addresses. The server only trusts forwarded addresses from a proxy on the same machine.
- Minimal systemd unit:

```ini
[Service]
WorkingDirectory=/path/to/disc-it
Environment=PORT=3000
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
```

## Production deployment

Production game and leaderboard: **https://gyute.fyi/disk-it/**.
Pushes to `main` trigger `.github/workflows/deploy.yml`, which uses a dedicated restricted SSH key to deploy the exact commit on the VPS. Other branches do not deploy production. The build runs server/hosting tests before switching the service.

VPS builds use `VITE_BASE_PATH=/disk-it/`. Default `npm run build` still uses `/`, preserving the separate Vercel frontend; that Vercel deployment does not host this SQLite API. Caddy strips `/disk-it` before forwarding to Express. The VPS sets `BIND_HOST=127.0.0.1`, `PORT=8082`, and `DB_PATH=/data/scores.db`; persistent storage is bind-mounted from `/var/lib/disc-it` and must be writable by UID 1000.

Operational configuration, recovery and SQLite-safe backups are documented in the private `Bynzski/gyute-lab` repository. Do not delete the data directory during deployment. Online backups use SQLite's backup API, not a bare copy of a WAL-mode database.

## Tests

Browser tests require Playwright with Chromium and a development server at `http://localhost:5173`. Install Playwright separately and set `PLAYWRIGHT_PATH` to its module path (the scripts otherwise fall back to the original development machine's installation).

```sh
npm run test:course
npm run test:preview
node scripts/bank-alignment.cjs
```

Leaderboard server and helper tests need no browser: `npm run test:leaderboard`. The run-mode browser checks need the dev server: `npm run test:runmode-browser`.

The course is inspired by coastal Florida parks; it is not a surveyed recreation of the real Tocobaga course. Flight is a simplified gameplay model, not a full aerodynamic simulation.
