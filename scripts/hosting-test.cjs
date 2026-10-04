const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('server binds only the requested BIND_HOST', async t => {
  const net = require('node:net');
  const { spawn } = require('node:child_process');
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root, env: { ...process.env, PORT: String(port), BIND_HOST: '127.0.0.2', DB_PATH: ':memory:' },
  });
  t.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 5000);
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`server exited: ${code}`)); });
  });
  // Raw HTTP avoids any environment HTTP proxy.
  const request = host => new Promise((resolve, reject) => {
    require('node:http').get({ host, port, path: '/api/leaderboard?course=forest&format=all' }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    }).on('error', reject);
  });
  assert.equal(await request('127.0.0.2'), 200);
  await assert.rejects(request('127.0.0.1'), { code: 'ECONNREFUSED' });
});

test('Vite uses VITE_BASE_PATH for deployment assets', async t => {
  const previous = process.env.VITE_BASE_PATH;
  t.after(() => { if (previous === undefined) delete process.env.VITE_BASE_PATH; else process.env.VITE_BASE_PATH = previous; });
  process.env.VITE_BASE_PATH = '/disk-it/';
  const { resolveConfig } = await import('vite');
  const config = await resolveConfig({ root }, 'build');
  assert.equal(config.base, '/disk-it/');
});

test('default Vite build and development keep root hosting', async t => {
  const previous = process.env.VITE_BASE_PATH;
  t.after(() => { if (previous === undefined) delete process.env.VITE_BASE_PATH; else process.env.VITE_BASE_PATH = previous; });
  delete process.env.VITE_BASE_PATH;
  const { resolveConfig, build } = await import('vite');
  assert.equal((await resolveConfig({ root }, 'serve')).base, '/');
  const output = await build({ root, logLevel: 'silent', build: { write: false } });
  const html = output.output.find(asset => asset.fileName === 'index.html').source;
  assert.match(html, /src="\/assets\//);
  assert.match(html, /href="\/assets\//);
  assert(!html.includes('/disk-it/assets/')); // absolute canonical/social URLs may mention /disk-it/
  const api = await builtApi('/');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ rows: [], rank: 1 }) };
  });
  await api.fetchBoard('forest', 'front');
  await api.submitRun({ name: 'Jay', course: 'forest', format: 'front', holes: [] });
  assert.deepEqual(calls, ['/api/leaderboard?course=forest&format=front&limit=10', '/api/rounds']);
});

async function builtApi(base) {
  const { build } = await import('vite');
  const output = await build({
    configFile: false, root, base, logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry: path.join(root, 'src/game/leaderboardApi.js'), formats: ['es'] } },
  });
  return import(`data:text/javascript;base64,${Buffer.from(output[0].output[0].code).toString('base64')}`);
}

test('built leaderboard request uses the deployment subpath', async t => {
  const api = await builtApi('/disk-it/');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init]);
    return { ok: true, json: async () => ({ rows: [{ rank: 1 }] }) };
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await api.fetchBoard('forest', 'front', { signal }), [{ rank: 1 }]);
  assert.equal(calls[0][0], '/disk-it/api/leaderboard?course=forest&format=front&limit=10');
  assert.equal(calls[0][1].signal, signal);
});

test('built round submission uses the deployment subpath', async t => {
  const api = await builtApi('/disk-it/');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init]);
    return { ok: true, json: async () => ({ id: 7, rank: 1 }) };
  });
  const payload = { name: 'Jay', course: 'forest', format: 'front', holes: Array(9).fill(3) };
  assert.deepEqual(await api.submitRun(payload), { id: 7, rank: 1 });
  assert.equal(calls[0][0], '/disk-it/api/rounds');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
});
