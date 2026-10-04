# Leaderboard & Run Modes — Design

Date: 2026-10-03

## Goal
A small, for-fun, shared online leaderboard for the disc golf game, hosted by the owner on a personal VPS. Players choose **Free play** or **Leaderboard run**; finished runs post to a global board kept per course and round format. Lightweight and throwaway: no accounts, one server file, one SQLite file.

## Decisions (agreed)
- Audience: shared online, anyone who opens the game.
- Anti-cheat: light checks only (server-side validation + rate limit). Not tamper-proof; accepted.
- Stack: Express + `better-sqlite3`; the server also serves the built `dist/`.
- Extras in v1: personal bests, per-hole stats (stored, minimal read endpoint, no UI), title-screen top-10 board.
- Boards are separate per `(course, format)`; formats are `front`, `back`, `all`.

## Modes
**Free play** — current behavior (restart/replay allowed). Never submits.

**Leaderboard run**
- `restartHole()` is a no-op. R key and Restart button hidden. End-of-hole card shows only Next hole / Finish (no "Replay hole").
- "Quit run" button returns to title after a confirm; submits and saves nothing.
- Reloading the page mid-run abandons the run (run state is not persisted).
- Score posts only when the final hole of the selected format is completed.

Title screen: Free play / Leaderboard run toggle next to the Front 9 / Back 9 / All 18 options, default Free play.

## Server (`server/index.js`)
- Creates `data/scores.db` on startup (`data/` gitignored).
- Tables:
  - `rounds(id INTEGER PK, name TEXT, course TEXT, format TEXT, total_throws INT, par_diff INT, created_at INT)`
  - `round_holes(round_id INT, hole_index INT, throws INT, PRIMARY KEY(round_id, hole_index))`
  - Index on `rounds(course, format, par_diff, created_at)`.
- `POST /api/rounds` body `{name, course, format, holes: [int…]}`. Validation:
  - course ∈ known courses; format ∈ {front, back, all}; `holes.length` is 9 (front/back) or 18 (all).
  - each throws is an integer in 1..15.
  - name trimmed, control chars stripped, 1..16 chars.
  - total and `par_diff` are computed server-side from a par table (source of truth: the course data modules; if they cannot be imported without `three`, generate `server/pars.json` from them and keep it in sync via a test).
  - in-memory rate limit ~5 posts/min/IP.
  - Response: `{id, rank}`; rank = 1 + count of rounds in the same board with a better `(par_diff, created_at)`.
- `GET /api/leaderboard?course=&format=&limit=` → top N (default 10, max 50) ordered by `par_diff ASC, created_at ASC`.
- `GET /api/holes/:course` → average throws per hole.
- Serves `dist/` statically. Port from `PORT` env (default 3000). Dev: Vite proxies `/api` to the server; `npm run dev` unchanged; add an `npm run server` script.

## Client
- Name prompt on the first finished run; stored in `localStorage` and prefilled after.
- Personal best per `(course, format)` in `localStorage`; end card shows "New personal best!" when beaten.
- After a run, the end card shows "You ranked #N" with a View board button.
- Title screen shows the top-10 panel for the selected course/format in both modes; it refreshes on course/format change. Unreachable server → "Leaderboard offline"; play is unaffected.
- Submission failure → toast and one retry; never blocks Play again.

## Out of scope
Accounts, edit/delete, stronger anti-cheat, per-hole stats UI, persisting runs across reloads.

## Testing
`scripts/leaderboard-test.cjs` (matches existing `scripts/*.cjs` style; add `test:leaderboard` script). Starts the server against a temp DB and covers: valid post and rank; rejects for bad hole count, out-of-range throws, bad name, unknown course/format; ranking order and tie-break; rate limit; par table matches course data. A client-level check confirms R / `restartHole()` leaves score and hole state untouched in leaderboard-run mode.
