export const MODES = { FREE: 'free', RUN: 'run' };
export const FORMAT_LABELS = { front: 'Front 9', back: 'Back 9', all: 'All 18' };

// Leaderboard runs count every throw: no restarting a hole.
export const canRestart = mode => mode !== MODES.RUN;

export const formatDiff = diff => (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff));
