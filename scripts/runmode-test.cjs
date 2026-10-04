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
