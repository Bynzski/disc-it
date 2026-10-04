# Leaderboard & Run Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Free play / Leaderboard run mode choice, and a small shared online leaderboard (per course and round format) backed by SQLite on the owner's VPS.

**Architecture:** A tiny Express server (`server/`) owns a SQLite file, validates submissions against the real course par tables, and serves the built game plus a JSON API. The client gets pure helper modules (`src/game/`) for run rules, personal bests, API calls and submission, thin wiring in `main.js`, and HUD additions (mode toggle, title-screen top-10, quit button, post-round panel).

**Tech Stack:** Node (ESM server), Express 4, better-sqlite3, Vite (dev proxy), `node:test` for server and pure-module tests, Playwright for browser checks (same as existing `scripts/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-03-leaderboard-design.md`

## Global Constraints

- Boards are separate per `(course, format)`; course ids are exactly `tocobaga`, `thunderbird`, `forest`; formats are exactly `front`, `back`, `all`.
- Hole count must be 9 for `front`/`back`, 18 for `all`; throws per hole are integers 1..15; name is 1..16 chars after trim and control-char stripping.
- Total and par diff are computed server-side from the course data modules, never trusted from the client.
- Ranking: `par_diff ASC, created_at ASC, id ASC`. Rank returned from POST = 1 + rounds strictly ahead on that order.
- Rate limit: about 5 POSTs/min/IP, in memory. Server listens on `PORT` (default 3000), DB at `data/scores.db` (`DB_PATH` overrides), `data/` gitignored.
- In Leaderboard run mode `restartHole()` is a no-op, the R key / Restart button / "Replay hole" button are hidden, and reloading abandons the run.
- Free play behaves exactly as today and never submits.
- `npm run dev` keeps working unchanged (Vite on 5173, `/api` proxied to the server on 3000).
- Player-supplied names are rendered with `textContent` / DOM APIs only, never `innerHTML`.
- **Dirty working tree:** `src/main.js`, `src/ui/HUD.js` and `src/ui/style.css` already contain large uncommitted changes from the owner's Cedar/Thunderbird work, and `package.json` has two uncommitted `test:cedar` / `test:thunderbird` lines. Work in the current tree (the forest course only exists there). Never `git add` those three src files, and never use `git add -A` or `git add .`. Stage exact paths only. `package.json` is staged whole (the two pre-existing script lines ride along; mention that in the final report).
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but a happy-path test would miss, most likely first. Each has a pinning test in the task named in brackets.

1. Malformed or hostile POST bodies (broken JSON, wrong types, floats, `NaN`, `holes` as a string, prototype-ish course names like `__proto__`, oversized body) must return a clean 4xx JSON error, never a 500 or a crash. [Tasks 1, 3]
2. A Back 9 round must store absolute hole indexes 9..17, or per-hole averages mix front and back nine. [Task 2]
3. A player name like `<img src=x onerror=alert(1)>` must show on the board as literal text. [Task 6]
4. Board server down or blocked: the title screen shows "Leaderboard offline" and Play still works; a failed post shows an error with Retry and never blocks leaving the card. [Tasks 4, 6]
5. Typing in the name box must not trigger game shortcuts (`r` replay, `n` next, `v` view, `1/2/3` discs). [Task 6]

---

### Task 1: Course pars and submission validation

**Files:**
- Create: `server/courses.js`
- Create: `scripts/leaderboard-test.cjs`
- Modify: `package.json` (deps + scripts)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `COURSE_PARS: {tocobaga:number[18], thunderbird:number[18], forest:number[18]}`, `FORMAT_RANGE: {front:[0,9], back:[9,18], all:[0,18]}`, `MAX_THROWS = 15`, `NAME_MAX = 16`, `validateSubmission(body) -> {ok:true, value:{name, course, format, holes:number[], totalThrows, parDiff, holeOffset}} | {ok:false, error:string}`.

- [ ] **Step 1: Install dependencies and add scripts**

Run: `npm install express@4 better-sqlite3`

If `better-sqlite3` fails to install (native build), STOP and tell the owner. The fallback is Node's built-in `node:sqlite`, which is a small change confined to `server/db.js` in Task 2.

Edit `package.json` scripts to add (keep existing entries):

```json
    "server": "node server/index.js",
    "test:leaderboard": "node --test scripts/leaderboard-test.cjs scripts/runmode-test.cjs",
    "test:runmode-browser": "node scripts/runmode-browser-test.cjs"
```

Append to `.gitignore`:

```
data/
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/leaderboard-test.cjs`:

```js
// Leaderboard server tests. Pure Node: no browser and no dev server needed.
// Run with `npm run test:leaderboard`.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

let courses;
before(async () => { courses = await import('../server/courses.js'); });

const good = (over = {}) => ({ name: 'Jay', course: 'tocobaga', format: 'all', holes: Array(18).fill(3), ...over });

test('par tables come from the real course data', () => {
  for (const id of ['tocobaga', 'thunderbird', 'forest']) {
    const pars = courses.COURSE_PARS[id];
    assert.equal(pars.length, 18, id);
    assert(pars.every(p => Number.isInteger(p) && p >= 2 && p <= 6), id);
  }
});

test('valid full round: server computes totals and par diff', () => {
  const pars = courses.COURSE_PARS.tocobaga;
  const holes = pars.map(p => p + 1);
  const r = courses.validateSubmission(good({ name: '  Jay  ', holes }));
  assert.equal(r.ok, true);
  assert.equal(r.value.name, 'Jay');
  assert.equal(r.value.totalThrows, pars.reduce((a, b) => a + b, 0) + 18);
  assert.equal(r.value.parDiff, 18);
  assert.equal(r.value.holeOffset, 0);
});

test('front and back nine use their own par slice and hole offset', () => {
  const pars = courses.COURSE_PARS.thunderbird;
  const front = courses.validateSubmission(good({ course: 'thunderbird', format: 'front', holes: Array(9).fill(3) }));
  assert.equal(front.value.parDiff, 27 - pars.slice(0, 9).reduce((a, b) => a + b, 0));
  assert.equal(front.value.holeOffset, 0);
  const back = courses.validateSubmission(good({ course: 'thunderbird', format: 'back', holes: Array(9).fill(3) }));
  assert.equal(back.value.parDiff, 27 - pars.slice(9).reduce((a, b) => a + b, 0));
  assert.equal(back.value.holeOffset, 9);
});

test('control characters are stripped from names', () => {
  const r = courses.validateSubmission(good({ name: 'Ja\ty\u0007' }));
  assert.equal(r.value.name, 'Jay');
});

const bad = {
  'unknown course': good({ course: 'nope' }),
  'proto course': good({ course: '__proto__' }),
  'inherited course': good({ course: 'constructor' }),
  'unknown format': good({ format: 'half' }),
  'front with 18 holes': good({ format: 'front' }),
  'all with 9 holes': good({ holes: Array(9).fill(3) }),
  'holes as string': good({ holes: '333333333333333333' }),
  'holes null': good({ holes: null }),
  'holes array-like object': good({ holes: { length: 18 } }),
  'zero throws': good({ holes: [0, ...Array(17).fill(3)] }),
  'too many throws': good({ holes: [16, ...Array(17).fill(3)] }),
  'fractional throws': good({ holes: [2.5, ...Array(17).fill(3)] }),
  'string throws': good({ holes: ['3', ...Array(17).fill(3)] }),
  'NaN throws': good({ holes: [NaN, ...Array(17).fill(3)] }),
  'null throws': good({ holes: [null, ...Array(17).fill(3)] }),
  'empty name': good({ name: '' }),
  'blank name': good({ name: '   ' }),
  'control-only name': good({ name: '\u0007\u0000' }),
  '17 char name': good({ name: 'a'.repeat(17) }),
  'numeric name': good({ name: 123 }),
  'object name': good({ name: {} }),
  'missing name': (() => { const b = good(); delete b.name; return b; })(),
};
for (const [label, body] of Object.entries(bad)) {
  test(`rejects: ${label}`, () => {
    const r = courses.validateSubmission(body);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
  });
}

for (const [label, body] of [['null', null], ['string', 'x'], ['array', []], ['undefined', undefined]]) {
  test(`rejects non-object body: ${label}`, () => {
    assert.equal(courses.validateSubmission(body).ok, false);
  });
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: FAIL (`Cannot find module '../server/courses.js'`).

- [ ] **Step 4: Write the implementation**

Create `server/courses.js`:

```js
// Par tables come straight from the game's course data, so server and client
// can never disagree about par.
import { HOLE_DATA } from '../src/course/Layout.js';
import { THUNDERBIRD_HOLES } from '../src/course/ThunderbirdCourse.js';
import { CEDAR_HOLES } from '../src/course/CedarCourse.js';

export const COURSE_PARS = {
  tocobaga: HOLE_DATA.map(h => h.par),
  thunderbird: THUNDERBIRD_HOLES.map(h => h.par),
  forest: CEDAR_HOLES.map(h => h.par),
};
export const FORMAT_RANGE = { front: [0, 9], back: [9, 18], all: [0, 18] };
export const MAX_THROWS = 15;
export const NAME_MAX = 16;

const fail = error => ({ ok: false, error });
const sum = list => list.reduce((a, b) => a + b, 0);

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX ? name : null;
}

export function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('body must be an object');
  const { course, format, holes } = body;
  if (typeof course !== 'string' || !Object.hasOwn(COURSE_PARS, course)) return fail('unknown course');
  if (typeof format !== 'string' || !Object.hasOwn(FORMAT_RANGE, format)) return fail('unknown format');
  const [from, to] = FORMAT_RANGE[format];
  const pars = COURSE_PARS[course].slice(from, to);
  if (!Array.isArray(holes) || holes.length !== pars.length) return fail(`expected ${pars.length} holes`);
  if (!holes.every(n => Number.isInteger(n) && n >= 1 && n <= MAX_THROWS)) return fail(`throws must be whole numbers 1-${MAX_THROWS}`);
  const name = cleanName(body.name);
  if (!name) return fail(`name must be 1-${NAME_MAX} characters`);
  const totalThrows = sum(holes);
  return { ok: true, value: { name, course, format, holes, totalThrows, parDiff: totalThrows - sum(pars), holeOffset: from } };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: all PASS. (Importing the course modules in Node worked when checked; if an import fails, report the error instead of working around it.)

- [ ] **Step 6: Commit**

```bash
git add server/courses.js scripts/leaderboard-test.cjs package.json package-lock.json .gitignore
git commit -m "Add leaderboard submission validation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: SQLite storage

**Files:**
- Create: `server/db.js`
- Modify: `scripts/leaderboard-test.cjs` (append tests)

**Interfaces:**
- Consumes: the `value` shape from `validateSubmission` (Task 1).
- Produces: `openDb(file) -> { addRound(value, createdAt) -> {id, rank}, leaderboard(course, format, limit) -> {rank, name, parDiff, totalThrows, createdAt}[], holeAverages(course) -> {holeIndex, avgThrows, rounds}[], close() }`. `file` may be `':memory:'`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/leaderboard-test.cjs`:

```js
// ---- storage ----
let openDb;
before(async () => { ({ openDb } = await import('../server/db.js')); });

const round = (over = {}) => ({ name: 'A', course: 'tocobaga', format: 'all', holes: Array(18).fill(3), totalThrows: 54, parDiff: 0, holeOffset: 0, ...over });

test('ranking: better par diff first, earlier wins ties, rank returned on insert', () => {
  const db = openDb(':memory:');
  assert.equal(db.addRound(round({ name: 'A', parDiff: 2 }), 1).rank, 1);
  assert.equal(db.addRound(round({ name: 'B', parDiff: -1 }), 2).rank, 1);
  assert.equal(db.addRound(round({ name: 'C', parDiff: 2 }), 3).rank, 3); // ties A, but later
  const rows = db.leaderboard('tocobaga', 'all', 10);
  assert.deepEqual(rows.map(r => [r.rank, r.name, r.parDiff]), [[1, 'B', -1], [2, 'A', 2], [3, 'C', 2]]);
  db.close();
});

test('ties inside the same millisecond fall back to insertion order', () => {
  const db = openDb(':memory:');
  db.addRound(round({ name: 'first' }), 5);
  assert.equal(db.addRound(round({ name: 'second' }), 5).rank, 2);
  assert.deepEqual(db.leaderboard('tocobaga', 'all', 10).map(r => r.name), ['first', 'second']);
  db.close();
});

test('boards are separate per course and format; limit applies', () => {
  const db = openDb(':memory:');
  for (let i = 0; i < 5; i++) db.addRound(round({ name: `p${i}`, parDiff: i }), i);
  db.addRound(round({ course: 'forest', parDiff: -9 }), 10);
  db.addRound(round({ format: 'front', holes: Array(9).fill(3), parDiff: -9 }), 11);
  assert.equal(db.leaderboard('tocobaga', 'all', 10).length, 5);
  assert.equal(db.leaderboard('tocobaga', 'all', 3).length, 3);
  assert.equal(db.leaderboard('forest', 'all', 10).length, 1);
  assert.equal(db.leaderboard('thunderbird', 'all', 10).length, 0);
  db.close();
});

test('back-nine rounds store absolute hole indexes 9..17', () => {
  const db = openDb(':memory:');
  db.addRound(round({ format: 'front', holes: [2, 2, 2, 2, 2, 2, 2, 2, 2], holeOffset: 0 }), 1);
  db.addRound(round({ format: 'back', holes: [5, 5, 5, 5, 5, 5, 5, 5, 5], holeOffset: 9 }), 2);
  const rows = db.holeAverages('tocobaga');
  assert.deepEqual(rows.map(r => r.holeIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(rows[0].avgThrows, 2);
  assert.equal(rows[9].avgThrows, 5);
  assert.equal(rows[9].rounds, 1);
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: new tests FAIL (`Cannot find module '../server/db.js'`).

- [ ] **Step 3: Write the implementation**

Create `server/db.js`:

```js
import Database from 'better-sqlite3';

export function openDb(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      course TEXT NOT NULL,
      format TEXT NOT NULL,
      total_throws INTEGER NOT NULL,
      par_diff INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rounds_board ON rounds(course, format, par_diff, created_at, id);
    CREATE TABLE IF NOT EXISTS round_holes (
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      hole_index INTEGER NOT NULL,
      throws INTEGER NOT NULL,
      PRIMARY KEY (round_id, hole_index)
    );
  `);

  const insertRound = db.prepare('INSERT INTO rounds (name, course, format, total_throws, par_diff, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertHole = db.prepare('INSERT INTO round_holes (round_id, hole_index, throws) VALUES (?, ?, ?)');
  const rankOf = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM rounds
    WHERE course = @course AND format = @format AND (
      par_diff < @diff OR (par_diff = @diff AND (created_at < @at OR (created_at = @at AND id < @id)))
    )`);
  const top = db.prepare(`
    SELECT name, par_diff AS parDiff, total_throws AS totalThrows, created_at AS createdAt FROM rounds
    WHERE course = ? AND format = ? ORDER BY par_diff ASC, created_at ASC, id ASC LIMIT ?`);
  const averages = db.prepare(`
    SELECT h.hole_index AS holeIndex, ROUND(AVG(h.throws), 2) AS avgThrows, COUNT(*) AS rounds
    FROM round_holes h JOIN rounds r ON r.id = h.round_id
    WHERE r.course = ? GROUP BY h.hole_index ORDER BY h.hole_index`);

  const add = db.transaction((v, createdAt) => {
    const id = Number(insertRound.run(v.name, v.course, v.format, v.totalThrows, v.parDiff, createdAt).lastInsertRowid);
    v.holes.forEach((throws, i) => insertHole.run(id, v.holeOffset + i, throws));
    const { rank } = rankOf.get({ course: v.course, format: v.format, diff: v.parDiff, at: createdAt, id });
    return { id, rank };
  });

  return {
    addRound: add,
    leaderboard: (course, format, limit) => top.all(course, format, limit).map((row, i) => ({ rank: i + 1, ...row })),
    holeAverages: course => averages.all(course),
    close: () => db.close(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db.js scripts/leaderboard-test.cjs
git commit -m "Add SQLite storage for leaderboard rounds" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HTTP API, rate limit, static serving, dev proxy

**Files:**
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `vite.config.js`
- Modify: `scripts/leaderboard-test.cjs` (append tests)

**Interfaces:**
- Consumes: `validateSubmission`, `COURSE_PARS`, `FORMAT_RANGE` (Task 1); `openDb` result (Task 2).
- Produces: `createApp({ db, staticDir?, now?, rateLimit? }) -> express app` where `rateLimit = {max, windowMs}`. HTTP:
  - `POST /api/rounds` → `201 {id, rank}` or `4xx {error}`.
  - `GET /api/leaderboard?course=&format=&limit=` → `{rows: [{rank, name, parDiff, totalThrows, createdAt}]}`.
  - `GET /api/holes/:course` → `{rows: [{holeIndex, avgThrows, rounds}]}`.
  - Unknown `/api/*` → `404 {error}`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/leaderboard-test.cjs`:

```js
// ---- HTTP ----
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function start(opts = {}) {
  const { createApp } = await import('../server/app.js');
  const db = openDb(':memory:');
  const app = createApp({ db, ...opts });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, db,
    close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(() => { db.close(); resolve(); }); }),
    post: (body, init = {}) => fetch(`${base}/api/rounds`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body), ...init }),
  };
}
const payload = (over = {}) => ({ name: 'Jay', course: 'tocobaga', format: 'front', holes: Array(9).fill(3), ...over });

test('POST then GET: valid round is stored and ranked', async () => {
  const s = await start();
  try {
    const first = await s.post(payload());
    assert.equal(first.status, 201);
    assert.deepEqual(Object.keys(await first.json()).sort(), ['id', 'rank']);
    const better = await s.post(payload({ name: 'Pro', holes: Array(9).fill(2) }));
    assert.equal((await better.json()).rank, 1);
    const board = await (await fetch(`${s.base}/api/leaderboard?course=tocobaga&format=front`)).json();
    assert.deepEqual(board.rows.map(r => r.name), ['Pro', 'Jay']);
    assert.equal(board.rows[0].rank, 1);
  } finally { await s.close(); }
});

test('leaderboard query validation and limit clamping', async () => {
  const s = await start();
  try {
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=nope&format=all`)).status, 400);
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=__proto__&format=all`)).status, 400);
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=forest&format=half`)).status, 400);
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=forest`)).status, 400);
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=forest&format=all&limit=abc`)).status, 200);
    assert.equal((await fetch(`${s.base}/api/leaderboard?course=forest&format=all&limit=9999`)).status, 200);
  } finally { await s.close(); }
});

test('hostile bodies get clean 4xx JSON, never 500', async () => {
  const s = await start();
  try {
    for (const body of ['{not json', '', 'null', '[]', '"text"', JSON.stringify(payload({ holes: '123456789' })), JSON.stringify(payload({ course: '__proto__' }))]) {
      const res = await s.post(body);
      assert(res.status >= 400 && res.status < 500, `${body} -> ${res.status}`);
      assert.equal(typeof (await res.json()).error, 'string');
    }
    const huge = await s.post(JSON.stringify(payload({ name: 'x'.repeat(10000) })));
    assert.equal(huge.status, 413);
    const wrongType = await fetch(`${s.base}/api/rounds`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(payload()) });
    assert.equal(wrongType.status, 400);
  } finally { await s.close(); }
});

test('rate limit: 5 per minute per IP, recovers after the window', async () => {
  let t = 1_000_000;
  const s = await start({ now: () => t, rateLimit: { max: 5, windowMs: 60_000 } });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await s.post(payload())).status, 201);
    const blocked = await s.post(payload());
    assert.equal(blocked.status, 429);
    assert(Number(blocked.headers.get('retry-after')) > 0);
    t += 61_000;
    assert.equal((await s.post(payload())).status, 201);
  } finally { await s.close(); }
});

test('hole averages endpoint and unknown routes', async () => {
  const s = await start();
  try {
    await s.post(payload({ format: 'back', holes: Array(9).fill(4) }));
    const rows = (await (await fetch(`${s.base}/api/holes/tocobaga`)).json()).rows;
    assert.deepEqual(rows.map(r => r.holeIndex), [9, 10, 11, 12, 13, 14, 15, 16, 17]);
    assert.equal((await fetch(`${s.base}/api/holes/__proto__`)).status, 400);
    assert.equal((await fetch(`${s.base}/api/nope`)).status, 404);
  } finally { await s.close(); }
});

test('serves the built game from staticDir', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<title>game</title>');
  const s = await start({ staticDir: dir });
  try {
    const res = await fetch(`${s.base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<title>game<\/title>/);
  } finally { await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: new tests FAIL (`Cannot find module '../server/app.js'`).

- [ ] **Step 3: Write the implementation**

Create `server/app.js`:

```js
import express from 'express';
import { COURSE_PARS, FORMAT_RANGE, validateSubmission } from './courses.js';

export function createApp({ db, staticDir, now = Date.now, rateLimit = { max: 5, windowMs: 60_000 } }) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a reverse proxy on the same box, trust only its X-Forwarded-For.
  app.set('trust proxy', 'loopback');

  const hits = new Map();
  const limiter = (req, res, next) => {
    const t = now();
    if (hits.size > 500) for (const [ip, list] of hits) if (list.every(x => t - x >= rateLimit.windowMs)) hits.delete(ip);
    const recent = (hits.get(req.ip) ?? []).filter(x => t - x < rateLimit.windowMs);
    if (recent.length >= rateLimit.max) {
      res.set('Retry-After', String(Math.ceil((recent[0] + rateLimit.windowMs - t) / 1000)));
      return res.status(429).json({ error: 'too many submissions, slow down' });
    }
    recent.push(t);
    hits.set(req.ip, recent);
    next();
  };

  app.post('/api/rounds', limiter, express.json({ limit: '4kb' }), (req, res) => {
    const checked = validateSubmission(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    res.status(201).json(db.addRound(checked.value, now()));
  });

  app.get('/api/leaderboard', (req, res) => {
    const { course, format } = req.query;
    if (typeof course !== 'string' || !Object.hasOwn(COURSE_PARS, course)) return res.status(400).json({ error: 'unknown course' });
    if (typeof format !== 'string' || !Object.hasOwn(FORMAT_RANGE, format)) return res.status(400).json({ error: 'unknown format' });
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    res.json({ rows: db.leaderboard(course, format, limit) });
  });

  app.get('/api/holes/:course', (req, res) => {
    if (!Object.hasOwn(COURSE_PARS, req.params.course)) return res.status(400).json({ error: 'unknown course' });
    res.json({ rows: db.holeAverages(req.params.course) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  if (staticDir) app.use(express.static(staticDir));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'server error' : 'bad request' });
  });
  return app;
}
```

Create `server/index.js`:

```js
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
```

Create `vite.config.js` (none exists today):

```js
import { defineConfig } from 'vite';

// `npm run dev` proxies the leaderboard API to `npm run server` (port 3000).
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/leaderboard-test.cjs`
Expected: all PASS.

- [ ] **Step 5: Smoke-test the real server**

Run: `PORT=3055 DB_PATH=/tmp/claude-1000/-home-jay-Projects-test/38b42b87-7080-45e0-a36d-d362060f83ec/scratchpad/smoke.db node server/index.js &` then
`curl -s -X POST localhost:3055/api/rounds -H 'content-type: application/json' -d '{"name":"Jay","course":"forest","format":"front","holes":[3,3,3,3,3,3,3,3,3]}'` and `curl -s 'localhost:3055/api/leaderboard?course=forest&format=front'`, then stop the server (`kill %1`).
Expected: first returns `{"id":1,"rank":1}`; second returns one row for Jay.

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/index.js vite.config.js scripts/leaderboard-test.cjs
git commit -m "Add leaderboard HTTP API, rate limit and dev proxy" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client helper modules (pure, no DOM)

**Files:**
- Create: `src/game/runMode.js`
- Create: `src/game/personal.js`
- Create: `src/game/leaderboardApi.js`
- Create: `src/game/runSubmit.js`
- Create: `scripts/runmode-test.cjs`

**Interfaces:**
- Produces:
  - `runMode.js`: `MODES = {FREE:'free', RUN:'run'}`, `canRestart(mode) -> boolean` (false only for `'run'`), `formatDiff(n) -> string` (`0 -> 'E'`, `-3 -> '-3'`, `2 -> '+2'`), `FORMAT_LABELS = {front:'Front 9', back:'Back 9', all:'All 18'}`.
  - `personal.js`: `createPersonalStore(storage = globalThis.localStorage) -> { getName(): string|null, setName(name), getBest(course, format): number|null, recordBest(course, format, parDiff): boolean }`. `recordBest` stores when there is no prior best or the new diff is lower, and returns `true` only when it beat an existing best. Never throws if storage is missing or throws.
  - `leaderboardApi.js`: `fetchBoard(course, format, {signal}?) -> Promise<row[]>`, `submitRun({name, course, format, holes}) -> Promise<{id, rank}>` (rejects with an Error carrying `.status`).
  - `runSubmit.js`: `createRunSubmitter({ submit, store }) -> async post({name, course, format, holes, parDiff}) -> {phase:'done', rank, newBest} | {phase:'error', message}`. Saves the trimmed name before submitting; records the personal best only after a successful submit.

- [ ] **Step 1: Write the failing tests**

Create `scripts/runmode-test.cjs`:

```js
// Pure client-logic tests for leaderboard runs. Run with `npm run test:leaderboard`.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = file => import(`../src/game/${file}`);
const memoryStorage = (seed = {}) => {
  const data = { ...seed };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};

test('only run mode forbids restarting', async () => {
  const { MODES, canRestart } = await load('runMode.js');
  assert.equal(canRestart(MODES.FREE), true);
  assert.equal(canRestart(MODES.RUN), false);
});

test('formatDiff', async () => {
  const { formatDiff } = await load('runMode.js');
  assert.deepEqual([0, -3, 2].map(formatDiff), ['E', '-3', '+2']);
});

test('personal store: name round trip and bests', async () => {
  const { createPersonalStore } = await load('personal.js');
  const store = createPersonalStore(memoryStorage());
  assert.equal(store.getName(), null);
  store.setName('Jay');
  assert.equal(store.getName(), 'Jay');
  assert.equal(store.getBest('forest', 'all'), null);
  assert.equal(store.recordBest('forest', 'all', 4), false); // first result is not "beaten"
  assert.equal(store.getBest('forest', 'all'), 4);
  assert.equal(store.recordBest('forest', 'all', 4), false); // equal is not better
  assert.equal(store.recordBest('forest', 'all', 6), false);
  assert.equal(store.getBest('forest', 'all'), 4);
  assert.equal(store.recordBest('forest', 'all', 1), true);
  assert.equal(store.getBest('forest', 'all'), 1);
  assert.equal(store.getBest('forest', 'front'), null); // per course+format
});

test('personal store survives missing, throwing and corrupt storage', async () => {
  const { createPersonalStore } = await load('personal.js');
  const none = createPersonalStore(null);
  none.setName('x');
  assert.equal(none.getName(), null);
  assert.equal(none.recordBest('forest', 'all', 1), false);
  const throwing = createPersonalStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  throwing.setName('x');
  assert.equal(throwing.getBest('forest', 'all'), null);
  const corrupt = createPersonalStore(memoryStorage({ 'disc-it:bests': '{not json' }));
  assert.equal(corrupt.getBest('forest', 'all'), null);
  assert.equal(corrupt.recordBest('forest', 'all', 3), false);
  assert.equal(corrupt.getBest('forest', 'all'), 3);
});

test('submitter: success saves name, ranks and flags a beaten best', async () => {
  const { createRunSubmitter } = await load('runSubmit.js');
  const { createPersonalStore } = await load('personal.js');
  const store = createPersonalStore(memoryStorage());
  store.recordBest('forest', 'all', 5);
  const post = createRunSubmitter({ submit: async () => ({ id: 7, rank: 3 }), store });
  const result = await post({ name: '  Jay ', course: 'forest', format: 'all', holes: Array(18).fill(3), parDiff: 2 });
  assert.deepEqual(result, { phase: 'done', rank: 3, newBest: true });
  assert.equal(store.getName(), 'Jay');
  assert.equal(store.getBest('forest', 'all'), 2);
});

test('submitter: failure reports an error, keeps the name, does not touch the best, and retry works', async () => {
  const { createRunSubmitter } = await load('runSubmit.js');
  const { createPersonalStore } = await load('personal.js');
  const store = createPersonalStore(memoryStorage());
  store.recordBest('forest', 'all', 5);
  let calls = 0;
  const submit = async () => { if (calls++ === 0) throw Object.assign(new Error('server error'), { status: 500 }); return { id: 1, rank: 1 }; };
  const post = createRunSubmitter({ submit, store });
  const args = { name: 'Jay', course: 'forest', format: 'all', holes: Array(18).fill(3), parDiff: 1 };
  const failed = await post(args);
  assert.equal(failed.phase, 'error');
  assert.match(failed.message, /server error/);
  assert.equal(store.getName(), 'Jay');
  assert.equal(store.getBest('forest', 'all'), 5);
  assert.deepEqual(await post(args), { phase: 'done', rank: 1, newBest: true });
});

test('submitter: a 429 gets a friendly message', async () => {
  const { createRunSubmitter } = await load('runSubmit.js');
  const { createPersonalStore } = await load('personal.js');
  const post = createRunSubmitter({ submit: async () => { throw Object.assign(new Error('x'), { status: 429 }); }, store: createPersonalStore(memoryStorage()) });
  const result = await post({ name: 'Jay', course: 'forest', format: 'all', holes: [], parDiff: 0 });
  assert.match(result.message, /wait a moment/i);
});

test('leaderboardApi builds the right requests', async () => {
  const { fetchBoard, submitRun } = await load('leaderboardApi.js');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init]);
    if (String(url).startsWith('/api/leaderboard')) return { ok: true, json: async () => ({ rows: [{ rank: 1 }] }) };
    return { ok: false, status: 400, json: async () => ({ error: 'unknown course' }) };
  };
  assert.deepEqual(await fetchBoard('forest', 'front'), [{ rank: 1 }]);
  assert.equal(calls[0][0], '/api/leaderboard?course=forest&format=front&limit=10');
  await assert.rejects(submitRun({ name: 'a', course: 'x', format: 'all', holes: [] }), err => err.status === 400 && /unknown course/.test(err.message));
  assert.equal(calls[1][1].method, 'POST');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/runmode-test.cjs`
Expected: FAIL (cannot find `../src/game/runMode.js`).

- [ ] **Step 3: Write the implementation**

Create `src/game/runMode.js`:

```js
export const MODES = { FREE: 'free', RUN: 'run' };
export const FORMAT_LABELS = { front: 'Front 9', back: 'Back 9', all: 'All 18' };

// Leaderboard runs count every throw: no restarting a hole.
export const canRestart = mode => mode !== MODES.RUN;

export const formatDiff = diff => (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff));
```

Create `src/game/personal.js`:

```js
const NAME_KEY = 'disc-it:name';
const BESTS_KEY = 'disc-it:bests';

// Browser storage can be missing, blocked or corrupt; this never throws.
export function createPersonalStore(storage = globalThis.localStorage) {
  const read = key => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, value); } catch { /* ignore */ } };
  const readBests = () => {
    try {
      const parsed = JSON.parse(read(BESTS_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  };
  const keyOf = (course, format) => `${course}:${format}`;

  return {
    getName: () => read(NAME_KEY),
    setName: name => write(NAME_KEY, name),
    getBest: (course, format) => readBests()[keyOf(course, format)] ?? null,
    // Stores the best; returns true only when it beat an existing best.
    recordBest(course, format, parDiff) {
      const bests = readBests();
      const prev = bests[keyOf(course, format)];
      if (prev !== undefined && parDiff >= prev) return false;
      bests[keyOf(course, format)] = parDiff;
      write(BESTS_KEY, JSON.stringify(bests));
      return prev !== undefined;
    },
  };
}
```

Create `src/game/leaderboardApi.js`:

```js
export async function fetchBoard(course, format, { signal } = {}) {
  const res = await fetch(`/api/leaderboard?course=${course}&format=${format}&limit=10`, { signal });
  if (!res.ok) throw Object.assign(new Error(`leaderboard ${res.status}`), { status: res.status });
  return (await res.json()).rows;
}

export async function submitRun({ name, course, format, holes }) {
  const res = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, course, format, holes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `submit ${res.status}`), { status: res.status });
  }
  return res.json();
}
```

Create `src/game/runSubmit.js`:

```js
export function createRunSubmitter({ submit, store }) {
  return async function post({ name, course, format, holes, parDiff }) {
    const clean = name.trim();
    store.setName(clean);
    try {
      const { rank } = await submit({ name: clean, course, format, holes });
      return { phase: 'done', rank, newBest: store.recordBest(course, format, parDiff) };
    } catch (err) {
      const message = err.status === 429 ? 'Please wait a moment and try again' : err.message || 'network error';
      return { phase: 'error', message };
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:leaderboard`
Expected: all server and client-module tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game scripts/runmode-test.cjs
git commit -m "Add client run-mode, personal best and submission helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: HUD changes (mode toggle, board, quit button, run panel)

`src/ui/HUD.js` and `src/ui/style.css` contain pre-existing uncommitted changes. Edit in place; **do not commit them** (see Global Constraints).

**Files:**
- Modify: `src/ui/HUD.js`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `formatDiff`, `FORMAT_LABELS` from `src/game/runMode.js` (Task 4).
- Produces (consumed by Task 6):
  - Constructor options added: `onBoardChange(courseId, format)`, `onQuitRun()`, `onSubmitRun(name)`, `onRetryRun()`. `onStartRound` is now called as `onStartRound(format, mode)` with `mode` `'free'|'run'`.
  - Instance fields: `hud.courseId` (`'tocobaga'|'thunderbird'|'forest'`), `hud.roundFormat`, `hud.runMode` (`'free'|'run'`).
  - `hud.renderBoard({status:'loading'|'offline'}|{status:'ok', rows})`.
  - `hud.update(data)` additionally reads `data.runMode` (boolean) and `data.runResult` (`null | {phase:'name'} | {phase:'posting'} | {phase:'done', rank, newBest} | {phase:'error', message}`).

- [ ] **Step 1: Add the import**

At the top of `src/ui/HUD.js`, with the other imports, add:

```js
import { FORMAT_LABELS, formatDiff } from '../game/runMode.js';
```

- [ ] **Step 2: Add the markup**

In the HUD template in `src/ui/HUD.js`:

(a) In `<nav class="pg-actions" ...>`, directly after the `pg-restart` button line, add:

```html
        <button type="button" class="pg-chunk" id="pg-quit" hidden title="Abandon this run without posting a score">Quit run</button>
```

(b) In the landing section, directly after the closing `</div>` of `<div class="pg-round-options" role="radiogroup" aria-label="Round format">…</div>`, add:

```html
              <div class="pg-round-options pg-mode-options" role="radiogroup" aria-label="Game mode">
                <button type="button" data-run-mode="free" role="radio" aria-checked="true" class="is-selected">Free play</button>
                <button type="button" data-run-mode="run" role="radio" aria-checked="false">Leaderboard run</button>
              </div>
              <p class="pg-mode-hint" id="pg-mode-hint">Replay holes as often as you like. Scores aren't posted.</p>
```

(c) Directly before `<div class="pg-title-future" aria-disabled="true">`, add:

```html
          <aside class="pg-board" aria-label="Leaderboard">
            <h3 class="pg-board-title" id="pg-board-title">Top 10</h3>
            <ol class="pg-board-list" id="pg-board-list"></ol>
            <p class="pg-board-note" id="pg-board-note" hidden></p>
          </aside>
```

(d) In the final card, directly before `<div class="pg-final-actions">`, add:

```html
          <div class="pg-run-panel" id="pg-run-panel" hidden>
            <form class="pg-run-form" id="pg-run-form" hidden>
              <label for="pg-run-name-input">Name for the board</label>
              <input id="pg-run-name-input" maxlength="16" autocomplete="nickname" required>
              <button type="submit" class="pg-chunk">Post score</button>
            </form>
            <p class="pg-run-status" id="pg-run-status" aria-live="polite"></p>
            <button type="button" class="pg-chunk" id="pg-run-retry" hidden>Retry</button>
          </div>
```

- [ ] **Step 3: Register elements and handlers**

In the constructor's destructured options (line starting `constructor({ holes, onStartRound, …`), add `onBoardChange, onQuitRun, onSubmitRun, onRetryRun` to the list.

In the id array passed to the `get` helper (the list that ends `'final-title', 'final-card',`), append:

```js
'quit', 'mode-hint', 'board-title', 'board-list', 'board-note', 'run-panel', 'run-form', 'run-name-input', 'run-status', 'run-retry',
```

Next to the other `addEventListener` calls (after `this.el['final-restart'].addEventListener(...)`), add:

```js
    this.el.quit.addEventListener('click', () => onQuitRun?.());
    this.el['run-form'].addEventListener('submit', event => {
      event.preventDefault();
      const name = this.el['run-name-input'].value.trim();
      if (name) onSubmitRun?.(name);
    });
    this.el['run-retry'].addEventListener('click', () => onRetryRun?.());
```

Replace the existing course/round/start handlers block. Change `this.roundFormat = 'all';` to also declare state, and make `selectRound` notify the board:

```js
    this.courseId = 'tocobaga';
    this.runMode = 'free';
    this.roundFormat = 'all';
```

Inside `selectRound`, as the last statement, add:

```js
      onBoardChange?.(this.courseId, this.roundFormat);
```

In the course button click handler, set the id before `selectRound(this.roundFormat)` runs, e.g. directly after `const id = button.dataset.course, info = courseInfo[id];` add `this.courseId = id;` (as its own statement on the next line).

Add the mode toggle handler after the round-format handler line (`for (const button of this.roundButtons) button.addEventListener(...)`):

```js
    this.modeButtons = [...this.root.querySelectorAll('[data-run-mode]')];
    const hints = { free: "Replay holes as often as you like. Scores aren't posted.", run: 'Every throw counts: no restarts. Finish the round to post your score.' };
    for (const button of this.modeButtons) button.addEventListener('click', () => {
      this.runMode = button.dataset.runMode;
      for (const other of this.modeButtons) {
        const active = other === button;
        other.classList.toggle('is-selected', active);
        other.setAttribute('aria-checked', String(active));
      }
      this.el['mode-hint'].textContent = hints[this.runMode];
    });
```

Replace the start handler so it passes the mode:

```js
    this.el['start-round'].addEventListener('click', () => onStartRound?.(this.roundFormat, this.runMode));
```

- [ ] **Step 4: Add `renderBoard` and run-panel rendering**

Add a method to the HUD class (next to `toast`):

```js
  // Board rows hold player-supplied names: build them with DOM APIs, never innerHTML.
  renderBoard(board) {
    const list = this.el['board-list'];
    const note = this.el['board-note'];
    const info = { tocobaga: 'Tocobaga Park', thunderbird: 'Thunderbird Gardens', forest: 'Cedar Hollow' }[this.courseId];
    this.el['board-title'].textContent = `Top 10 · ${info} · ${FORMAT_LABELS[this.roundFormat]}`;
    list.replaceChildren();
    note.hidden = board.status === 'ok' && board.rows.length > 0;
    if (board.status === 'loading') note.textContent = 'Loading…';
    else if (board.status === 'offline') note.textContent = 'Leaderboard offline';
    else if (board.rows.length === 0) note.textContent = 'No scores yet. Be the first!';
    if (board.status !== 'ok') return;
    for (const row of board.rows) {
      const li = document.createElement('li');
      for (const [cls, text] of [['rank', String(row.rank)], ['who', row.name], ['score', formatDiff(row.parDiff)]]) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        li.append(span);
      }
      list.append(li);
    }
  }

  renderRunResult(result) {
    const r = result ?? { phase: 'posting' };
    this.el['run-form'].hidden = r.phase !== 'name';
    this.el['run-retry'].hidden = r.phase !== 'error';
    const text = {
      name: 'Enter a name to post your round.',
      posting: 'Posting score…',
      done: `You ranked #${r.rank}${r.newBest ? ' · New personal best!' : ''}`,
      error: `Couldn't post your score (${r.message}).`,
    }[r.phase];
    if (this.runText !== text) { this.runText = text; this.el['run-status'].textContent = text; }
  }
```

In `update(data)`, directly after the line `const roundComplete = data.finished && data.roundOver;`, add:

```js
    const inRun = Boolean(data.runMode);
    this.el.restart.hidden = inRun;
    this.el.quit.hidden = !inRun || isLanding;
    this.el['final-restart'].hidden = inRun;
    this.el['run-panel'].hidden = !(inRun && roundComplete);
    if (inRun && roundComplete) this.renderRunResult(data.runResult);
```

Change the last-hole "next" label so a finished run goes back to the title. Replace

```js
      ? `<kbd>N</kbd> New round`
```

with

```js
      ? (data.runMode ? `<kbd>N</kbd> Back to title` : `<kbd>N</kbd> New round`)
```

- [ ] **Step 5: Styles**

First read the existing `.pg-round-options`, `.pg-title-future` and `.pg-final-actions` rules in `src/ui/style.css` so new rules match their spacing, borders and fonts (`var(--ink)`, `var(--paper)`, `var(--paper-2)`, `var(--font)`, `var(--display)`). Then append to `src/ui/style.css`:

```css
/* ---- Leaderboard & run modes ---- */
.pg-root [hidden] { display: none !important; }
.pg-mode-hint { margin: 6px 0 0; font-size: 13px; font-weight: 700; opacity: .8; }
.pg-board { margin-top: 12px; padding: 10px 14px; background: var(--paper); color: var(--ink); border: 3px solid var(--ink); border-radius: 14px; box-shadow: 0 4px 0 var(--ink); max-width: 360px; }
.pg-board-title { margin: 0 0 6px; font: 900 15px var(--display); }
.pg-board-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-weight: 800; font-size: 14px; }
.pg-board-list li { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; }
.pg-board-list .rank { opacity: .6; }
.pg-board-list .who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-board-note { margin: 0; font-weight: 700; font-size: 14px; opacity: .75; }
.pg-run-panel { margin: 12px 0 4px; display: grid; gap: 8px; justify-items: center; }
.pg-run-form { display: grid; gap: 6px; justify-items: center; }
.pg-run-form input { padding: 6px 10px; font: 800 16px var(--font); border: 3px solid var(--ink); border-radius: 10px; text-align: center; }
.pg-run-status { margin: 0; font: 900 16px var(--display); }
@media (max-width: 640px) { .pg-board { max-width: none; } }
```

- [ ] **Step 6: Verify the page still loads**

With `npm run dev` running (it already is on 5173), load `http://localhost:5173` in the browser tool or run `curl -s localhost:5173/src/ui/HUD.js | head -5` and confirm Vite serves it without a transform error. Visual checks happen in Task 6.

- [ ] **Step 7: No commit**

Leave `src/ui/HUD.js` and `src/ui/style.css` uncommitted (pre-existing owner changes in the same files).

---

### Task 6: Wire run mode into `main.js` and browser checks

`src/main.js` also has pre-existing uncommitted changes. Edit in place; **do not commit it**. Commit only the new test script.

**Files:**
- Modify: `src/main.js`
- Create: `scripts/runmode-browser-test.cjs`

**Interfaces:**
- Consumes: HUD options/fields/methods from Task 5; `canRestart`, `MODES` (`runMode.js`), `createPersonalStore`, `createRunSubmitter`, `fetchBoard`, `submitRun` (Task 4).
- Produces: dev-only hook `window.__discState` (the live `state` object) for the browser test.

- [ ] **Step 1: Write the failing browser test**

Create `scripts/runmode-browser-test.cjs`:

```js
// Run-mode browser checks. Requires the Vite dev server on http://localhost:5173
// (npm run dev) and Playwright (set PLAYWRIGHT_PATH if it is installed elsewhere).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const URL = process.env.GAME_URL || 'http://localhost:5173';
const xss = '<img src=x onerror=alert(1)>';

async function openGame(browser, board) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.route('**/api/leaderboard*', route => board === 'offline'
    ? route.abort()
    : route.fulfill({ json: { rows: board } }));
  await page.goto(URL);
  await page.waitForSelector('#pg-start-round');
  return { page, dialogs };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // 1. Board renders hostile names as literal text.
    {
      const { page, dialogs } = await openGame(browser, [{ rank: 1, name: xss, parDiff: -2, totalThrows: 52, createdAt: 1 }]);
      await page.waitForSelector('#pg-board-list li');
      assert.equal(await page.locator('#pg-board-list img').count(), 0);
      assert.equal(await page.locator('#pg-board-list .who').first().textContent(), xss);
      assert.equal(await page.locator('#pg-board-list .score').first().textContent(), '-2');
      assert.deepEqual(dialogs, []);
      await page.close();
    }

    // 2. Offline board: message shown, Play still works.
    {
      const { page } = await openGame(browser, 'offline');
      await page.waitForFunction(() => document.querySelector('#pg-board-note')?.textContent === 'Leaderboard offline');
      await page.click('#pg-start-round');
      await page.waitForFunction(() => window.__discState && window.__discState.showLanding === false);
      await page.close();
    }

    // 3. Free play restarts; leaderboard run does not.
    for (const mode of ['free', 'run']) {
      const { page } = await openGame(browser, []);
      if (mode === 'run') await page.click('[data-run-mode="run"]');
      await page.click('#pg-start-round');
      await page.waitForFunction(() => window.__discState && window.__discState.showLanding === false);
      assert.equal(await page.locator('#pg-restart').isHidden(), mode === 'run');
      assert.equal(await page.locator('#pg-quit').isHidden(), mode === 'free');
      await page.evaluate(() => { window.__discState.throws = 2; });
      await page.keyboard.press('r');
      const throws = await page.evaluate(() => window.__discState.throws);
      assert.equal(throws, mode === 'run' ? 2 : 0, `${mode}: throws after R`);
      await page.close();
    }

    // 4. Name box swallows shortcuts instead of replaying / skipping.
    {
      const { page } = await openGame(browser, []);
      await page.click('[data-run-mode="run"]');
      await page.click('#pg-start-round');
      await page.waitForFunction(() => window.__discState && window.__discState.showLanding === false);
      await page.evaluate(() => {
        const s = window.__discState;
        s.scores = s.scores.map(() => 3);
        s.finished = true;
        s.runResult = { phase: 'name' };
      });
      await page.waitForSelector('#pg-run-name-input', { state: 'visible' });
      await page.fill('#pg-run-name-input', '');
      await page.click('#pg-run-name-input');
      await page.keyboard.type('rnv123');
      assert.equal(await page.inputValue('#pg-run-name-input'), 'rnv123');
      const after = await page.evaluate(() => ({ finished: window.__discState.finished, holeIndex: window.__discState.holeIndex, scores: window.__discState.scores.length, throwsSet: window.__discState.scores.every(s => s === 3) }));
      assert.deepEqual(after, { finished: true, holeIndex: 0, scores: 18, throwsSet: true });
      await page.close();
    }
    console.log('run-mode browser checks passed');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/runmode-browser-test.cjs`
Expected: FAIL (`window.__discState` is undefined, or the board/mode elements do not react yet). If Playwright cannot be required, find the install with `ls ~/.npm/_npx/*/node_modules/playwright` and set `PLAYWRIGHT_PATH`.

- [ ] **Step 3: Wire `main.js`**

Add imports at the top of `src/main.js`, next to the other imports:

```js
import { MODES, canRestart } from './game/runMode.js';
import { createPersonalStore } from './game/personal.js';
import { createRunSubmitter } from './game/runSubmit.js';
import { fetchBoard, submitRun } from './game/leaderboardApi.js';
```

Next to `let roundHoles = holes;` add:

```js
let courseId = 'tocobaga';
let runResult = null;
let boardSeq = 0;
const personal = createPersonalStore();
const postRunScore = createRunSubmitter({ submit: submitRun, store: personal });
```

In the `state` object literal add two fields after `finished: false,`:

```js
  runMode: false,
  runId: 0,
```

Directly after the `state` object's closing `};` add the dev-only test hook:

```js
if (import.meta.env.DEV) window.__discState = state;
// Expose the run result to tests that need to force the post-round panel.
Object.defineProperty(state, 'runResult', { get: () => runResult, set: v => { runResult = v; }, enumerable: false });
```

Add the new HUD callbacks to the `new HUD({ ... })` options (alongside `onRestart`):

```js
  onBoardChange: () => refreshBoard(),
  onQuitRun: quitRun,
  onSubmitRun: name => postRun(name),
  onRetryRun: () => postRun(runResult?.name ?? personal.getName() ?? ''),
```

In `selectCourse(id)`, change the first `course = courses[id]; …` line to also record the id: add `courseId = id;` as its own statement directly before it.

Replace `startRound` with:

```js
function startRound(format = 'all', mode = MODES.FREE) {
  if (!state.showLanding) return;
  roundHoles = format === 'front' ? holes.slice(0, 9) : format === 'back' ? holes.slice(9) : holes;
  state.roundFormat = format;
  state.runMode = mode === MODES.RUN;
  state.runId++;
  runResult = null;
  state.scores = roundHoles.map(() => null);
  startHole(0);
}
```

Replace `restartHole` with:

```js
function restartHole() {
  if (state.showLanding || !canRestart(state.runMode ? MODES.RUN : MODES.FREE)) return;
  state.scores[state.holeIndex] = null;
  startHole(state.holeIndex);
}
```

Replace `nextHole` with:

```js
function nextHole() {
  // Advance only after a scored finish; N must not skip unplayed holes.
  if (!state.finished) return;
  if (state.holeIndex + 1 < roundHoles.length) {
    startHole(state.holeIndex + 1);
  } else if (state.runMode) {
    returnToTitle();
  } else {
    state.scores = roundHoles.map(() => null);
    startHole(0);
  }
}
```

In `finishHole`, directly after the line `const last = state.holeIndex + 1 >= roundHoles.length;` add:

```js
  if (last && state.runMode) completeRun();
```

Add these functions directly after `finishHole`:

```js
function returnToTitle() {
  preview.skip();
  if (isMouseCaptured()) document.exitPointerLock?.();
  runResult = null;
  state.runMode = false;
  state.runId++;
  state.showLanding = true;
  state.finished = false;
  state.mode = 'aiming';
  state.charging = false;
  state.power = 0;
  state.velocity.set(0, 0, 0);
  roundHoles = holes;
  state.scores = holes.map(() => null);
  state.holeIndex = 0;
  state.lie.copy(holes[0].tee);
  state.position.copy(holes[0].tee);
  state.landingTime = 0;
  state.cameraSnap = true;
  touchControls.clear();
  disc.resetTrail();
  pointAimAtBasket();
  updateHUD();
  refreshBoard();
}

function quitRun() {
  if (!state.runMode || state.showLanding) return;
  if (!confirm('Quit this run? Your score will not be posted.')) return;
  returnToTitle();
}

function completeRun() {
  const name = personal.getName();
  if (name) postRun(name);
  else runResult = { phase: 'name' };
}

async function postRun(name) {
  if (!state.runMode || !name) return;
  const runId = state.runId;
  runResult = { phase: 'posting', name };
  updateHUD();
  const throws = state.scores.reduce((sum, score) => sum + score, 0);
  const parDiff = throws - roundHoles.reduce((sum, h) => sum + h.par, 0);
  const result = await postRunScore({ name, course: courseId, format: state.roundFormat, holes: [...state.scores], parDiff });
  if (runId !== state.runId) return; // run was abandoned while the request was in flight
  runResult = { ...result, name: name.trim() };
  updateHUD();
  refreshBoard();
}

async function refreshBoard() {
  const seq = ++boardSeq;
  const [id, format] = [hud.courseId, hud.roundFormat];
  hud.renderBoard({ status: 'loading' });
  try {
    const rows = await fetchBoard(id, format);
    if (seq === boardSeq) hud.renderBoard({ status: 'ok', rows });
  } catch {
    if (seq === boardSeq) hud.renderBoard({ status: 'offline' });
  }
}
```

In `updateHUD`'s `hud.update({ ... })` object add:

```js
    runMode: state.runMode,
    runResult,
```

In the `keydown` handler, add this as the very first line inside the handler (so typing a name never triggers shortcuts):

```js
  if (e.target instanceof HTMLInputElement) return;
```

In the same handler change `startRound(hud.roundFormat);` to:

```js
    startRound(hud.roundFormat, hud.runMode);
```

Directly before `renderer.setAnimationLoop(animate);` add the initial board load:

```js
refreshBoard();
```

- [ ] **Step 4: Run the browser test to verify it passes**

Run: `node scripts/runmode-browser-test.cjs`
Expected: `run-mode browser checks passed`.

- [ ] **Step 5: Run the existing browser tests that touch the HUD/start flow**

Run: `node scripts/round-format-test.cjs` and `node scripts/landing-test.cjs`
Expected: both still pass. If either fails, check whether it failed before these changes by running `git stash` is NOT allowed here (pre-existing uncommitted work); instead read the failure and fix only regressions caused by this plan's changes, and report any failure that looks pre-existing.

- [ ] **Step 6: Visual check**

With the dev server and `npm run server` both running, use Playwright (as in the test) to take screenshots of the title screen at 1280×720 and 390×844, and of the final card in run mode (force it using `window.__discState` as in the test). Look for: the board overlapping the Play button or course cards, horizontal page scroll on mobile, and an unreadable name form. Adjust the CSS appended in Task 5 until all three look clean. Report the screenshots' file paths.

- [ ] **Step 7: Commit only the new test script**

```bash
git add scripts/runmode-browser-test.cjs
git commit -m "Add run-mode browser checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end check and deploy notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full round against the real server**

Run `npm run server` (port 3000) and `npm run dev`. Read `scripts/course-round.cjs` to see how the existing tests finish real holes in the browser, and reuse that approach in a throwaway script (scratchpad, not committed) to play a Leaderboard run on Back 9 against `http://localhost:5173`. Confirm that after the last hole: the name form appears, posting shows "You ranked #1", pressing N returns to the title, the title board lists the entry, and `curl localhost:3000/api/holes/<course>` shows hole indexes 9-17.

If `course-round.cjs` gives no practical way to finish a real hole, do not add a production hook. Instead start both servers, tell the owner exactly what to click, and ask them to play one Back 9 run and report what they see. Say plainly in the final report that this step was verified by the owner and not by script.

- [ ] **Step 2: Document running and deploying**

Append a "Leaderboard" section to `README.md` covering: `npm run build && npm run server` (serves the game and API on `PORT`, default 3000; data in `data/scores.db`, back it up by copying that file), `npm run dev` + `npm run server` for development, `npm run test:leaderboard` and `npm run test:runmode-browser`, and a reverse-proxy note: proxy everything to the Node port and pass `X-Forwarded-For` so the rate limit sees real IPs (the server trusts only loopback proxies). Include a minimal systemd unit example (`ExecStart=/usr/bin/node server/index.js`, `WorkingDirectory=`, `Environment=PORT=3000`).

- [ ] **Step 3: Run everything once**

Run: `npm run test:leaderboard && node scripts/runmode-browser-test.cjs`
Expected: all PASS.

- [ ] **Step 4: Commit and report**

```bash
git add README.md
git commit -m "Document leaderboard server and deployment" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Final report to the owner must state: which files are committed; that `src/main.js`, `src/ui/HUD.js`, `src/ui/style.css` now contain leaderboard changes mixed into their pre-existing uncommitted work and were deliberately left uncommitted; that `package.json` was committed whole, including the owner's two `test:cedar` / `test:thunderbird` lines; and the small deviations from the spec (failed posts get a Retry button instead of a single automatic retry; the name form appears only when no name is stored yet).
