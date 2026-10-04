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
  const s = await start({ rateLimit: { max: 1000, windowMs: 60_000 } }); // this test sends more than 5 posts
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
