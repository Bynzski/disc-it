// Integration test: requires a running Docker daemon. No public ports are published.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const docker = (...args) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('production image serves subpath assets with a read-only root and persistent scores', { timeout: 600_000 }, async t => {
  const tag = `disc-it-hosting-test:${process.pid}`;
  const volume = `disc-it-hosting-test-${process.pid}`;
  const containers = [];
  t.after(() => {
    for (const id of containers) { try { docker('rm', '-f', id); } catch {} }
    try { docker('volume', 'rm', volume); } catch {}
    try { docker('image', 'rm', tag); } catch {}
  });
  docker('build', '-t', tag, '.');
  docker('volume', 'create', volume);
  const start = async () => {
    const id = docker('run', '-d', '--read-only', '-v', `${volume}:/data`, tag);
    containers.push(id);
    docker('exec', id, 'node', '-e', `
      (async () => {
        for (let i = 0; i < 100; i++) {
          try { const r = await fetch('http://127.0.0.1:3000/api/leaderboard?course=forest&format=front'); if (r.ok) return; } catch {}
          await new Promise(r => setTimeout(r, 100));
        }
        process.exit(1);
      })();`);
    return id;
  };
  const request = (id, route, options = {}) => JSON.parse(docker('exec', id, 'node', '-e', `
    (async () => { const r = await fetch('http://127.0.0.1:3000' + ${JSON.stringify(route)}, ${JSON.stringify(options)});
    console.log(JSON.stringify({ status: r.status, body: await r.text() })); })();`));
  const first = await start();
  assert.equal(docker('exec', first, 'node', '-p', 'process.versions.node.split(".")[0]'), '24');
  assert.notEqual(docker('exec', first, 'node', '-p', 'process.getuid()'), '0');
  assert.equal(docker('exec', first, 'sh', '-c', 'command -v python3 || command -v g++ || true'), '');
  const html = request(first, '/');
  assert.equal(html.status, 200);
  const assets = [...html.body.matchAll(/(?:src|href)="(\/disk-it\/assets\/[^\"]+)"/g)].map(m => m[1]);
  assert(assets.length >= 2, 'JS and CSS assets must use /disk-it/');
  // Caddy strips /disk-it before forwarding to Express.
  for (const asset of assets) assert.equal(request(first, asset.slice('/disk-it'.length)).status, 200);
  const posted = request(first, '/api/rounds', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Docker test', course: 'forest', format: 'front', holes: Array(9).fill(3) }),
  });
  assert.equal(posted.status, 201);
  assert.equal(JSON.parse(posted.body).rank, 1);
  docker('stop', first);
  const second = await start();
  const board = request(second, '/api/leaderboard?course=forest&format=front');
  assert.equal(board.status, 200);
  assert.equal(JSON.parse(board.body).rows[0].name, 'Docker test');
});
