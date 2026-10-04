import express from 'express';
import { COURSE_PARS, FORMAT_RANGE, validateSubmission } from './courses.js';

export function createApp({ db, staticDir, now = Date.now, rateLimit = { max: 5, windowMs: 60_000 } }) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a reverse proxy on the same box, trust only its X-Forwarded-For.
  app.set('trust proxy', 'loopback');

  const hits = new Map();
  const limiter = (req, res, next) => {
    const t = now();
    if (hits.size > 500) for (const [ip, list] of hits) if (list.every(x => t - x >= rateLimit.windowMs)) hits.delete(ip);
    const recent = (hits.get(req.ip) ?? []).filter(x => t - x < rateLimit.windowMs);
    if (recent.length >= rateLimit.max) {
      res.set('Retry-After', String(Math.ceil((recent[0] + rateLimit.windowMs - t) / 1000)));
      return res.status(429).json({ error: 'too many submissions, slow down' });
    }
    recent.push(t);
    hits.set(req.ip, recent);
    next();
  };

  app.post('/api/rounds', limiter, express.json({ limit: '4kb' }), (req, res) => {
    const checked = validateSubmission(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    res.status(201).json(db.addRound(checked.value, now()));
  });

  app.get('/api/leaderboard', (req, res) => {
    const { course, format } = req.query;
    if (typeof course !== 'string' || !Object.hasOwn(COURSE_PARS, course)) return res.status(400).json({ error: 'unknown course' });
    if (typeof format !== 'string' || !Object.hasOwn(FORMAT_RANGE, format)) return res.status(400).json({ error: 'unknown format' });
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    res.json({ rows: db.leaderboard(course, format, limit) });
  });

  app.get('/api/holes/:course', (req, res) => {
    if (!Object.hasOwn(COURSE_PARS, req.params.course)) return res.status(400).json({ error: 'unknown course' });
    res.json({ rows: db.holeAverages(req.params.course) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  if (staticDir) app.use(express.static(staticDir));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'server error' : 'bad request' });
  });
  return app;
}
