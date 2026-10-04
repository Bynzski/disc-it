// Deterministic helpers for Thunderbird Gardens. Everything here is seeded hashing,
// so every build of the course places exactly the same desert dressing.
export function hash2(ix, iz, seed = 0) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul((seed | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = t => t * t * (3 - 2 * t);
export function noise2(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = fade(x - ix), fz = fade(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// Fractal noise in 0..1; `scale` is the feature size in world units.
export function fbm(x, z, scale, seed = 0, octaves = 3) {
  let amp = .5, sum = 0, norm = 0, f = 1 / scale;
  for (let i = 0; i < octaves; i++, amp *= .5, f *= 2.03) { sum += amp * noise2(x * f + i * 17.3, z * f - i * 9.1, seed + i * 31); norm += amp; }
  return sum / norm;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
