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
