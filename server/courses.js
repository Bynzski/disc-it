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
