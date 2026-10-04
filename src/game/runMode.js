export const MODES = { FREE: 'free', RUN: 'run' };
export const FORMAT_LABELS = { front: 'Front 9', back: 'Back 9', all: 'All 18' };

// Leaderboard runs count every throw: no restarting a hole.
export const canRestart = mode => mode !== MODES.RUN;

// The server rejects holes over 15 throws, so a run records at most that (an automatic pick-up).
export const MAX_HOLE_THROWS = 15;
export const recordedThrows = throws => Math.min(throws, MAX_HOLE_THROWS);

// A run posts once: not while a post is in flight or after it has landed.
export const canPost = result => !result || result.phase === 'name' || result.phase === 'error';

export const formatDiff = diff => (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff));
