import Database from 'better-sqlite3';

export function openDb(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      course TEXT NOT NULL,
      format TEXT NOT NULL,
      total_throws INTEGER NOT NULL,
      par_diff INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rounds_board ON rounds(course, format, par_diff, created_at, id);
    CREATE TABLE IF NOT EXISTS round_holes (
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      hole_index INTEGER NOT NULL,
      throws INTEGER NOT NULL,
      PRIMARY KEY (round_id, hole_index)
    );
  `);

  const insertRound = db.prepare('INSERT INTO rounds (name, course, format, total_throws, par_diff, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertHole = db.prepare('INSERT INTO round_holes (round_id, hole_index, throws) VALUES (?, ?, ?)');
  const rankOf = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM rounds
    WHERE course = @course AND format = @format AND (
      par_diff < @diff OR (par_diff = @diff AND (created_at < @at OR (created_at = @at AND id < @id)))
    )`);
  const top = db.prepare(`
    SELECT name, par_diff AS parDiff, total_throws AS totalThrows, created_at AS createdAt FROM rounds
    WHERE course = ? AND format = ? ORDER BY par_diff ASC, created_at ASC, id ASC LIMIT ?`);
  const averages = db.prepare(`
    SELECT h.hole_index AS holeIndex, ROUND(AVG(h.throws), 2) AS avgThrows, COUNT(*) AS rounds
    FROM round_holes h JOIN rounds r ON r.id = h.round_id
    WHERE r.course = ? GROUP BY h.hole_index ORDER BY h.hole_index`);

  const add = db.transaction((v, createdAt) => {
    const id = Number(insertRound.run(v.name, v.course, v.format, v.totalThrows, v.parDiff, createdAt).lastInsertRowid);
    v.holes.forEach((throws, i) => insertHole.run(id, v.holeOffset + i, throws));
    const { rank } = rankOf.get({ course: v.course, format: v.format, diff: v.parDiff, at: createdAt, id });
    return { id, rank };
  });

  return {
    addRound: add,
    leaderboard: (course, format, limit) => top.all(course, format, limit).map((row, i) => ({ rank: i + 1, ...row })),
    holeAverages: course => averages.all(course),
    close: () => db.close(),
  };
}
