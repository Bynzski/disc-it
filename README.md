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

## Tests

Browser tests require Playwright with Chromium and a development server at `http://localhost:5173`. Install Playwright separately and set `PLAYWRIGHT_PATH` to its module path (the scripts otherwise fall back to the original development machine's installation).

```sh
npm run test:course
npm run test:preview
node scripts/bank-alignment.cjs
```

The course is inspired by coastal Florida parks; it is not a surveyed recreation of the real Tocobaga course. Flight is a simplified gameplay model, not a full aerodynamic simulation.
