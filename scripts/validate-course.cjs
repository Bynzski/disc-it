// Run against `npm run dev -- --host 0.0.0.0 --port 5173`.
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
mkdirSync('test-results', { recursive:true });
for (const file of ['course-smoke.cjs', 'course-round.cjs']) {
  const result = spawnSync(process.execPath, [`scripts/${file}`], { encoding:'utf8', timeout:240000 });
  const output = (result.stdout || '') + (result.stderr || '') + (result.error ? String(result.error) : '');
  writeFileSync(`test-results/${file.replace('.cjs','.log')}`, output);
  process.stdout.write(output);
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All course validations passed. Logs: test-results/');
