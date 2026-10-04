import './style.css';
import { DISCS } from '../entities/Disc.js';
import { FORMAT_LABELS, formatDiff } from '../game/runMode.js';

const resultLabel = (throws, par) => {
  const diff = throws - par;
  if (diff === 0) return 'Par';
  if (diff === -1) return 'Birdie';
  if (diff === -2) return 'Eagle';
  if (diff === -3) return 'Albatross';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  return diff > 0 ? `+${diff}` : `${diff}`;
};


// Result tier drives the badge colour and celebration in the end-of-hole popup.
const tierOf = diff => diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff === 0 ? 'par' : diff === 1 ? 'bogey' : 'double';
const roundTierOf = diff => diff <= -4 ? 'eagle' : diff < 0 ? 'birdie' : diff === 0 ? 'par' : diff <= 4 ? 'bogey' : 'double';

const INK = '#1b1538';
const COURSE_CARDS = [
  {
    id: 'tocobaga', name: 'Tocobaga Park', tag: 'City park', color: '#4fc3f7',
    icon: `<svg class="pg-card-icon" aria-hidden="true" viewBox="0 0 64 48"><defs><clipPath id="pg-clip-a"><rect x="2" y="2" width="60" height="44" rx="10"/></clipPath></defs><rect x="2" y="2" width="60" height="44" rx="10" fill="#d4f1ff"/><g clip-path="url(#pg-clip-a)"><circle cx="51" cy="14" r="6" fill="#ffc72c" stroke="${INK}" stroke-width="2.5"/><path d="M0 36q16-7 32-2t32-2v16H0Z" fill="#5fd16a" stroke="${INK}" stroke-width="2.5"/><path d="M27 38q3-10 0-20" fill="none" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round"/><path d="M27 18q-10-6-16 0M27 18q-5-10-13-10M27 18q5-10 13-8M27 18q10-4 15 3" fill="none" stroke="#1fa36b" stroke-width="4.5" stroke-linecap="round"/></g><rect x="2" y="2" width="60" height="44" rx="10" fill="none" stroke="${INK}" stroke-width="3"/></svg>`,
  },
  {
    id: 'thunderbird', name: 'Thunderbird Gardens', tag: 'High desert', color: '#ff9a4d',
    icon: `<svg class="pg-card-icon" aria-hidden="true" viewBox="0 0 64 48"><defs><clipPath id="pg-clip-b"><rect x="2" y="2" width="60" height="44" rx="10"/></clipPath></defs><rect x="2" y="2" width="60" height="44" rx="10" fill="#ffe3b3"/><g clip-path="url(#pg-clip-b)"><circle cx="16" cy="13" r="6" fill="#ff5547" stroke="${INK}" stroke-width="2.5"/><path d="M20 42l8-22h13l5 8h6l8 14Z" fill="#d9472b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M-2 44l8-14h12l7 14Z" fill="#f08a45" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 40h64v8H0Z" fill="#f3b562" stroke="${INK}" stroke-width="2.5"/></g><rect x="2" y="2" width="60" height="44" rx="10" fill="none" stroke="${INK}" stroke-width="3"/></svg>`,
  },
  {
    id: 'forest', name: 'Cedar Hollow', tag: 'Old growth', color: '#7ddc6a',
    icon: `<svg class="pg-card-icon" aria-hidden="true" viewBox="0 0 64 48"><defs><clipPath id="pg-clip-c"><rect x="2" y="2" width="60" height="44" rx="10"/></clipPath></defs><rect x="2" y="2" width="60" height="44" rx="10" fill="#d6f2d0"/><g clip-path="url(#pg-clip-c)"><path d="M46 8l9 14h-5l8 12H34l8-12h-5Z" fill="#2f8f5b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 4l10 16h-6l10 15H6l10-15h-6Z" fill="#1f7a4d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 40h64v8H0Z" fill="#8a5a2b" stroke="${INK}" stroke-width="2.5"/></g><rect x="2" y="2" width="60" height="44" rx="10" fill="none" stroke="${INK}" stroke-width="3"/></svg>`,
  },
];

// Pre-computed confetti burst; the CSS animates each piece outward from the popup.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.18;
  const dist = 150 + (i % 3) * 55;
  const colors = ['#ffc72c', '#ff5547', '#2fd48f', '#38b6ff', '#8a5cff'];
  return `<i style="--x:${Math.round(Math.cos(angle) * dist)}px;--y:${Math.round(Math.sin(angle) * dist * 0.75)}px;--r:${(i * 83) % 360}deg;--c:${colors[i % colors.length]};--d:${(i % 6) * 22}ms"></i>`;
}).join('');

export class HUD {
  constructor({ holes, onStartRound, onSelectCourse, onRestart, onToggleView, onSelectDisc, onReleaseMouse, onNextHole, onTouchControl, onTouchThrowStart, onTouchThrowEnd, onTouchThrowCancel, onTouchFlat, onBoardChange, onQuitRun, onSubmitRun, onRetryRun }) {
    this.holes = holes;
    this.root = document.createElement('div');
    this.root.className = 'pg-root';
    this.root.innerHTML = `
      <div class="pg-vignette"></div>
      <header class="pg-topbar">
        <div class="pg-course pg-chunk">
          <div class="pg-hole-number" id="pg-hole-number">01</div>
          <div class="pg-course-text">
            <div class="pg-eyebrow" id="pg-course-name">Tocobaga Park</div>
            <h1 id="pg-hole-name">No. 1</h1>
            <div class="pg-meta" id="pg-hole-meta"><b class="pg-par">Par 3</b><span>282 ft</span></div>
          </div>
        </div>
        <div class="pg-stats" aria-label="Hole statistics">
          <div class="pg-stat pg-stat-throws pg-chunk"><span class="pg-eyebrow">Throws</span><b id="pg-throws">0</b></div>
          <div class="pg-stat pg-stat-distance pg-chunk"><span class="pg-eyebrow">To basket</span><b id="pg-distance">282 <small>ft</small></b></div>
        </div>
      </header>

      <div class="pg-crosshair" id="pg-crosshair" aria-label="Throw direction">
        <div class="pg-reticle"></div>
        <div class="pg-tilt-disc" id="pg-tilt-disc"><i></i></div>
        <div class="pg-aim-label"><b id="pg-cross-angle">0° Flat</b><span class="pg-hint-desktop">Scroll to tilt</span><span class="pg-hint-touch">Use tilt buttons</span></div>
      </div>

      <section class="pg-panel" aria-label="Shot setup">
        <div class="pg-charge" id="pg-charge" aria-hidden="true">
          <div class="pg-shot-row"><span class="pg-status" id="pg-status" data-state="ready">Ready</span><span id="pg-power-value">Power 0%</span></div>
          <div class="pg-power" role="progressbar" aria-label="Throw power" aria-valuemin="0" aria-valuemax="100"><div id="pg-power-fill"></div></div>
        </div>
        <div class="pg-panel-heading"><span class="pg-chip">Elevation <b id="pg-elevation">0°</b></span><span id="pg-disc-ratings" title="Speed / glide / turn / fade"></span></div>
        <div class="pg-disc-selector" role="group" aria-label="Choose disc">
          ${Object.entries(DISCS).map(([type, disc], index) => `
            <button type="button" data-disc="${type}" aria-keyshortcuts="${index + 1}" aria-pressed="false" title="${disc.description}" style="--disc-color:${disc.color}">
              <kbd>${index + 1}</kbd><i class="pg-disc-icon" aria-hidden="true"></i><span>${disc.name}</span>
            </button>
          `).join('')}
        </div>
        <span hidden><kbd>LMB</kbd> <span id="pg-throw-label"></span></span>
      </section>

      <nav class="pg-actions" aria-label="Game actions">
        <button type="button" class="pg-chunk" id="pg-view-toggle" aria-keyshortcuts="v" aria-pressed="false" title="Toggle elevated inspection view"><kbd>V</kbd><span id="pg-view-label">Elevated</span></button>
        <button type="button" class="pg-chunk" id="pg-restart" aria-keyshortcuts="r" title="Restart this hole"><kbd>R</kbd> Restart</button>
        <button type="button" class="pg-chunk" id="pg-quit" hidden title="Abandon this run without posting a score">Quit run</button>
        <button type="button" class="pg-chunk" id="pg-cursor" aria-keyshortcuts="Escape" title="Release mouse capture"><kbd>Esc</kbd> Cursor</button>
      </nav>

      <section class="pg-touch-controls" aria-label="Touch controls">
        <div class="pg-touch-stack pg-chunk">
          <div class="pg-touch-aim-hint">Drag screen to aim</div>
          <div class="pg-touch-tilt" aria-label="Disc tilt controls">
            <button type="button" class="pg-touch-button" data-touch-control="tilt-anhyzer" aria-label="Tilt anhyzer">Anhyzer</button>
            <button type="button" id="pg-touch-flat" class="pg-touch-button" aria-label="Reset disc tilt">Flat</button>
            <button type="button" class="pg-touch-button" data-touch-control="tilt-hyzer" aria-label="Tilt hyzer">Hyzer</button>
          </div>
          <button type="button" id="pg-touch-throw" class="pg-touch-throw" aria-label="Hold to set power, release to throw"><span>Hold</span><b>Power</b><em id="pg-touch-power">0%</em></button>
        </div>
      </section>
      <div class="pg-capture-hint" id="pg-capture-hint">Click course to aim</div>
      <div class="pg-toast" id="pg-toast" role="status"></div>

      <section class="pg-landing" id="pg-landing" role="dialog" aria-modal="true" aria-labelledby="pg-landing-title">
        <header class="pg-title-brand">
          <h2 id="pg-landing-title">Disc It<span aria-hidden="true"></span></h2>
          <div class="pg-title-subtitle">Forest, city and desert disc golf</div>
        </header>
        <div class="pg-title-menu">
          <div class="pg-title-dock" aria-label="Course selection">
            <div class="pg-title-course">
              <div class="pg-course-options" role="radiogroup" aria-label="Select course">
                ${COURSE_CARDS.map((card, index) => `
                <button type="button" data-course="${card.id}" role="radio" aria-checked="${index === 0}" class="pg-course-card${index === 0 ? ' is-selected' : ''}" style="--card:${card.color}">
                  ${card.icon}<span class="pg-card-name">${card.name}</span><span class="pg-card-tag">${card.tag}</span>
                </button>`).join('')}
              </div>
              <div class="pg-title-info">
                <h3 id="pg-selected-course">Tocobaga Park</h3>
                <small id="pg-course-description">Original Florida city-park course</small>
                <p id="pg-round-summary">${holes.length} Holes <span>•</span> Par ${holes.reduce((sum, h) => sum + h.par, 0)} <span>•</span> ${holes.reduce((sum, h) => sum + h.lengthFeet, 0)} ft</p>
              </div>
              <div class="pg-round-options" role="radiogroup" aria-label="Round format">
                <button type="button" data-round-format="front" role="radio" aria-checked="false">Front 9</button>
                <button type="button" data-round-format="back" role="radio" aria-checked="false">Back 9</button>
                <button type="button" data-round-format="all" role="radio" aria-checked="true" class="is-selected">All 18</button>
              </div>
            </div>
            <div class="pg-play-group">
              <button type="button" id="pg-start-round" class="pg-title-play" aria-keyshortcuts="Enter Space" aria-label="Free play: Tocobaga Park"><svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26"><path d="M7 3.5 20 12 7 20.5Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg><span>Free Play</span></button>
              <button type="button" id="pg-start-run" class="pg-title-play pg-title-run" aria-label="Play ranked: leaderboard run" title="Every throw counts: no restarts. Finish the round to post your score to the leaderboard."><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M7 3.5 20 12 7 20.5Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg><span>Ranked Play</span></button>
            </div>
          </div>
          <aside class="pg-board" aria-label="Leaderboard">
            <h3 class="pg-board-title" id="pg-board-title">Top 10</h3>
            <ol class="pg-board-list" id="pg-board-list"></ol>
            <p class="pg-board-note" id="pg-board-note" hidden></p>
          </aside>
          <div class="pg-title-future" aria-disabled="true">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
            More courses <span>Coming soon</span>
          </div>
        </div>
      </section>

      <div class="pg-final" id="pg-final" hidden role="dialog" aria-modal="true" aria-labelledby="pg-final-title">
        <div class="pg-final-card pg-chunk" id="pg-final-card" data-tier="par">
          <div class="pg-eyebrow" id="pg-final-eyebrow">TOCOBAGA · HOLE 01</div>
          <h2 id="pg-final-title">Hole complete</h2>
          <div class="pg-final-stage">
            <div class="pg-final-burst" aria-hidden="true"></div>
            <div class="pg-final-result" id="pg-final-result" data-delta="">Par</div>
          </div>
          <p id="pg-final-score"></p>
          <div class="pg-score-scroll" tabindex="0" role="region" aria-label="${holes.length}-hole scorecard; scroll horizontally for all holes"><table class="pg-scorecard" id="pg-scorecard">
            <thead><tr><th></th>${holes.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>TOT</th></tr></thead>
            <tbody>
              <tr><th scope="row">Par</th>${holes.map(h => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((sum, h) => sum + h.par, 0)}</td></tr>
              <tr><th scope="row">Score</th>${holes.map(() => '<td class="pg-score-cell">–</td>').join('')}<td class="pg-total" id="pg-score-total">–</td></tr>
            </tbody></table></div>
          <p class="pg-score-hint">Scroll scorecard to view all holes →</p>
          <div class="pg-run-panel" id="pg-run-panel" hidden>
            <form class="pg-run-form" id="pg-run-form" hidden>
              <label for="pg-run-name-input">Name for the board</label>
              <input id="pg-run-name-input" maxlength="16" autocomplete="nickname" required>
              <button type="submit" class="pg-chunk">Post score</button>
            </form>
            <p class="pg-run-status" id="pg-run-status" aria-live="polite"></p>
            <button type="button" class="pg-chunk" id="pg-run-retry" hidden>Retry</button>
          </div>
          <div class="pg-final-actions">
            <button type="button" id="pg-next" aria-keyshortcuts="n"><kbd>N</kbd> Next hole</button>
            <button type="button" id="pg-final-restart" aria-keyshortcuts="r"><kbd>R</kbd> Replay</button>
          </div>
        </div>
        <div class="pg-confetti" aria-hidden="true">${CONFETTI}</div>
      </div>
    `;
    document.body.appendChild(this.root);
    const get = id => this.root.querySelector(`#pg-${id}`);
    this.el = Object.fromEntries([
      'course-name', 'hole-number', 'hole-name', 'hole-meta', 'throws', 'distance', 'crosshair', 'cross-angle',
      'tilt-disc', 'charge', 'disc-ratings', 'elevation', 'power-value', 'power-fill', 'throw-label',
      'status', 'view-toggle', 'view-label', 'restart', 'cursor', 'capture-hint',
      'touch-throw', 'touch-power', 'touch-flat', 'toast', 'landing', 'start-round', 'start-run', 'round-summary', 'selected-course', 'course-description', 'final', 'final-eyebrow', 'final-result', 'final-score', 'final-restart', 'next', 'scorecard', 'score-total', 'final-title', 'final-card', 'quit', 'board-title', 'board-list', 'board-note', 'run-panel', 'run-form', 'run-name-input', 'run-status', 'run-retry',
    ].map(id => [id, get(id)]));
    this.scoreCells = [...this.root.querySelectorAll('.pg-score-cell')];
    this.powerBar = this.root.querySelector('.pg-power');
    this.discButtons = [...this.root.querySelectorAll('[data-disc]')];
    this.touchButtons = [...this.root.querySelectorAll('[data-touch-control]')];
    for (const button of this.discButtons) {
      button.addEventListener('click', () => onSelectDisc?.(button.dataset.disc));
    }
    this.el.restart.addEventListener('click', () => onRestart?.());
    this.el['view-toggle'].addEventListener('click', () => onToggleView?.());
    this.el.cursor.addEventListener('click', () => onReleaseMouse?.());
    this.el['final-restart'].addEventListener('click', () => onRestart?.());
    this.el.quit.addEventListener('click', () => onQuitRun?.());
    this.el['run-form'].addEventListener('submit', event => {
      event.preventDefault();
      const name = this.el['run-name-input'].value.trim();
      if (!name) return;
      this.el['run-name-input'].blur();
      onSubmitRun?.(name);
    });
    this.el['run-retry'].addEventListener('click', () => onRetryRun?.());
    this.el.next.addEventListener('click', () => onNextHole?.());
    this.activeHoles = holes;
    const courseInfo = {
      tocobaga: { name: 'Tocobaga Park', description: 'Original Florida city-park course' },
      thunderbird: { name: 'Thunderbird Gardens', description: 'Cedar City inspired high-desert course' },
      forest: { name: 'Cedar Hollow', description: 'Original old-growth conifer course' },
    };
    this.courseButtons = [...this.root.querySelectorAll('[data-course]')];
    this.courseId = 'tocobaga';
    this.runMode = 'free';
    this.roundFormat = 'all';
    this.roundButtons = [...this.root.querySelectorAll('[data-round-format]')];
    const selectRound = format => {
      this.roundFormat = format;
      const selected = format === 'front' ? this.activeHoles.slice(0, 9) : format === 'back' ? this.activeHoles.slice(9) : this.activeHoles;
      for (const button of this.roundButtons) {
        const active = button.dataset.roundFormat === format;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-checked', String(active));
      }
      this.el['round-summary'].innerHTML = `${selected.length} Holes <span>•</span> Par ${selected.reduce((sum, h) => sum + h.par, 0)} <span>•</span> ${selected.reduce((sum, h) => sum + h.lengthFeet, 0)} ft`;
      onBoardChange?.(this.courseId, this.roundFormat);
    };
    for (const button of this.courseButtons) button.addEventListener('click', () => {
      const id = button.dataset.course, info = courseInfo[id]; this.courseId = id; this.activeHoles = onSelectCourse?.(id) || this.activeHoles;
      this.courseButtons.forEach(b => { const active=b===button;b.classList.toggle('is-selected',active);b.setAttribute('aria-checked',String(active)); });
      this.el['selected-course'].textContent = info.name;
      this.el['course-description'].textContent = info.description;
      this.el['start-round'].setAttribute('aria-label', `Free play: ${info.name}`);
      selectRound(this.roundFormat);
    });
    for (const button of this.roundButtons) button.addEventListener('click', () => selectRound(button.dataset.roundFormat));
    this.el['start-round'].addEventListener('click', () => onStartRound?.(this.roundFormat, 'free'));
    this.el['start-run'].addEventListener('click', () => onStartRound?.(this.roundFormat, 'run'));

    const setTouchPressed = (button, pressed, event) => {
      event?.preventDefault();
      event?.stopPropagation();
      button.classList.toggle('is-pressed', pressed);
      onTouchControl?.(button.dataset.touchControl, pressed);
    };
    for (const button of this.touchButtons) {
      button.addEventListener('pointerdown', event => {
        if (button.disabled) return;
        button.setPointerCapture?.(event.pointerId);
        setTouchPressed(button, true, event);
      });
      button.addEventListener('pointerup', event => setTouchPressed(button, false, event));
      button.addEventListener('pointercancel', event => setTouchPressed(button, false, event));
      button.addEventListener('lostpointercapture', event => setTouchPressed(button, false, event));
    }
    this.el['touch-flat'].addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      onTouchFlat?.();
    });
    this.el['touch-throw'].addEventListener('pointerdown', event => {
      if (this.el['touch-throw'].disabled) return;
      event.preventDefault();
      event.stopPropagation();
      this.el['touch-throw'].setPointerCapture?.(event.pointerId);
      this.el['touch-throw'].classList.add('is-pressed');
      onTouchThrowStart?.();
    });
    this.el['touch-throw'].addEventListener('pointerup', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.el['touch-throw'].classList.contains('is-pressed')) return;
      this.el['touch-throw'].classList.remove('is-pressed');
      onTouchThrowEnd?.();
    });
    const cancelTouchThrow = event => {
      event.preventDefault();
      event.stopPropagation();
      this.el['touch-throw'].classList.remove('is-pressed');
      onTouchThrowCancel?.();
    };
    this.el['touch-throw'].addEventListener('pointercancel', cancelTouchThrow);
    this.el['touch-throw'].addEventListener('lostpointercapture', cancelTouchThrow);
  }

  update(data) {
    if (!data) return;
    if (this.scoreCells.length !== data.holes.length) {
      this.el.scorecard.innerHTML = `<thead><tr><th></th>${data.holes.map((h) => `<th>${h.id}</th>`).join('')}<th>TOT</th></tr></thead><tbody>
        <tr><th scope="row">Par</th>${data.holes.map(h => `<td>${h.par}</td>`).join('')}<td>${data.holes.reduce((sum, h) => sum + h.par, 0)}</td></tr>
        <tr><th scope="row">Score</th>${data.holes.map(() => '<td class="pg-score-cell">–</td>').join('')}<td class="pg-total" id="pg-score-total">–</td></tr></tbody>`;
      this.scoreCells = [...this.el.scorecard.querySelectorAll('.pg-score-cell')];
      this.root.querySelector('.pg-score-scroll').setAttribute('aria-label', `${data.holes.length}-hole scorecard; scroll horizontally for all holes`);
      this.el['score-total'] = this.el.scorecard.querySelector('#pg-score-total');
    }
    const profile = DISCS[data.discType] ?? { color: '#73b8c5', ratings: '' };
    const hole = data.hole;
    const isLanding = data.showLanding;
    this.root.classList.toggle('is-landing', isLanding);
    this.el.landing.hidden = !isLanding;
    this.root.style.setProperty('--active-disc', profile.color);
    for (const button of this.discButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.disc === data.discType));
      button.disabled = !data.canSelectDisc;
    }
    this.el['disc-ratings'].textContent = profile.ratings;
    this.el['course-name'].textContent = data.courseName;
    this.el['hole-number'].textContent = String(hole.id).padStart(2, '0');
    this.el['hole-name'].textContent = hole.name;
    this.setHTML('hole-meta', `<b class="pg-par">Par ${hole.par}</b><span>${hole.lengthFeet} ft</span>`);
    if (this.el.throws.textContent !== String(data.throws)) {
      this.el.throws.textContent = data.throws;
      this.retrigger(this.el.throws, 'is-bump');
    }
    this.setHTML('distance', `${Math.max(0, Math.round(data.distanceFeet))} <small>ft</small>`);
    this.el.elevation.textContent = `${Math.round(data.elevationDeg)}°`;
    this.el['cross-angle'].textContent = data.releaseLabel === 'Flat' ? '0° Flat' : data.releaseLabel;
    this.el['tilt-disc'].style.transform = `translate(-50%, -50%) rotate(${-data.releaseDeg || 0}deg)`;
    this.el.crosshair.hidden = isLanding || data.mode !== 'aiming' || data.finished;
    const power = Math.round(data.power * 100);
    this.root.style.setProperty('--touch-power', `${power}%`);
    // Chunky meter: the fill advances in 5% blocks (20 segments) and the CSS ramps its colour.
    this.powerBar.style.setProperty('--p', `${Math.ceil(power / 5) * 5}%`);
    this.powerBar.classList.toggle('is-max', power >= 90);
    this.el.charge.classList.toggle('is-active', !!data.charging);
    this.powerBar.setAttribute('aria-valuenow', power);
    this.el['power-value'].textContent = power >= 95 ? 'MAX POWER!' : `Power ${power}%`;
    this.el['touch-power'].textContent = `${power}%`;
    this.el['throw-label'].textContent = data.charging ? 'Release to throw' : 'Hold / release';
    const [statusText, statusState] = data.finished ? ['Complete', 'complete'] : data.mode === 'flying' ? ['In flight', 'flight'] : data.charging ? (data.powerRising ? ['↑ Rising', 'rising'] : ['↓ Falling', 'falling']) : ['Ready', 'ready'];
    this.el.status.textContent = statusText;
    this.el.status.dataset.state = statusState;
    this.el['view-label'].textContent = data.cameraView === 'first' ? 'Elevated' : 'First person';
    this.el['view-toggle'].setAttribute('aria-pressed', String(data.cameraView === 'third'));
    const canAim = !isLanding && data.mode === 'aiming' && !data.finished;
    this.el['view-toggle'].disabled = !canAim;
    this.el.cursor.disabled = !data.mouseCaptured;
    for (const button of this.touchButtons) button.disabled = !canAim;
    this.el['touch-flat'].disabled = !canAim;
    this.el['touch-throw'].disabled = !canAim;
    this.el['capture-hint'].hidden = isLanding || data.mouseCaptured || data.mode !== 'aiming' || data.finished;
    this.el.final.hidden = isLanding || !data.finished;
    this.el['final-eyebrow'].textContent = `${data.courseName.toUpperCase()} · HOLE ${String(hole.id).padStart(2, '0')}`;
    const isLast = data.holeIndex + 1 >= data.holeCount;
    this.setHTML('next', isLast
      ? (data.runMode ? `<kbd>N</kbd> Back to title` : `<kbd>N</kbd> New round`)
      : `<kbd>N</kbd> Next: No. ${data.holes[data.holeIndex + 1].id}`);
    const roundComplete = data.finished && data.roundOver;
    const inRun = Boolean(data.runMode);
    this.el.restart.hidden = inRun;
    this.el.quit.hidden = !inRun || isLanding;
    this.el['final-restart'].hidden = inRun;
    this.el['run-panel'].hidden = !(inRun && roundComplete);
    if (inRun && roundComplete) this.renderRunResult(data.runResult);
    this.el.final.classList.toggle('is-round-complete', roundComplete);
    this.el.scorecard.hidden = !roundComplete;
    this.el['final-title'].textContent = roundComplete ? 'Round complete' : 'Hole complete';
    this.setHTML('final-restart', `<kbd>R</kbd> Replay hole ${hole.id}`);
    if (data.finished) {
      const total = data.scores.reduce((sum, score) => sum + (score ?? 0), 0);
      const par = roundComplete ? data.holes.reduce((sum, h) => sum + h.par, 0) : hole.par;
      const throws = roundComplete ? total : data.throws;
      const diff = throws - par;
      const relative = diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff}`;
      this.el['final-eyebrow'].textContent = roundComplete ? `${data.courseName.toUpperCase()} · ROUND SCORECARD` : `${data.courseName.toUpperCase()} · HOLE ${hole.id}`;
      const label = roundComplete ? relative : resultLabel(throws, par);
      this.el['final-result'].textContent = label;
      this.el['final-result'].dataset.long = String(label.length > 8);
      this.el['final-result'].dataset.delta = roundComplete || diff === 0 || Math.abs(diff) > 3 ? '' : relative;
      this.el['final-card'].dataset.tier = roundComplete ? roundTierOf(diff) : tierOf(diff);
      this.el['final-score'].textContent = `${throws} throws · Par ${par} · ${relative}`;
      this.scoreCells.forEach((cell, i) => {
        const score = data.scores[i];
        cell.textContent = score ?? '–';
        const delta = score === null ? 0 : score - data.holes[i].par;
        // Colour plus shape (circle under par, square over) so the scoreboard never relies on colour alone.
        cell.className = `pg-score-cell ${score === null ? '' : delta < 0 ? 'under' : delta > 0 ? 'over' : 'even'}${delta <= -2 ? ' big-under' : ''}${delta >= 2 ? ' big-over' : ''}`;
      });
      this.el['score-total'].textContent = total;
    }
  }

  // Update innerHTML only when it changes: update() runs every frame and rebuilding a focused button would drop its focus.
  setHTML(id, html) {
    this.htmlCache ??= {};
    if (this.htmlCache[id] === html) return;
    this.htmlCache[id] = html;
    this.el[id].innerHTML = html;
  }

  // Restart a one-shot CSS animation class.
  retrigger(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  // Board rows hold player-supplied names: build them with DOM APIs, never innerHTML.
  renderBoard(board) {
    const list = this.el['board-list'];
    const note = this.el['board-note'];
    const info = { tocobaga: 'Tocobaga Park', thunderbird: 'Thunderbird Gardens', forest: 'Cedar Hollow' }[this.courseId];
    this.el['board-title'].textContent = `Top 10 · ${info} · ${FORMAT_LABELS[this.roundFormat]}`;
    list.replaceChildren();
    note.hidden = board.status === 'ok' && board.rows.length > 0;
    if (board.status === 'loading') note.textContent = 'Loading…';
    else if (board.status === 'offline') note.textContent = 'Leaderboard offline';
    else if (board.rows.length === 0) note.textContent = 'No scores yet. Be the first!';
    if (board.status !== 'ok') return;
    for (const row of board.rows) {
      const li = document.createElement('li');
      for (const [cls, text] of [['rank', String(row.rank)], ['who', row.name], ['score', formatDiff(row.parDiff)]]) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        li.append(span);
      }
      list.append(li);
    }
  }

  renderRunResult(result) {
    const r = result ?? { phase: 'posting' };
    const promptWasHidden = this.el['run-form'].hidden;
    this.el['run-form'].hidden = r.phase !== 'name';
    if (r.phase === 'name' && promptWasHidden) this.el['run-name-input'].focus();
    this.el['run-retry'].hidden = r.phase !== 'error';
    const text = {
      name: 'Enter a name to post your round.',
      posting: 'Posting score…',
      done: `You ranked #${r.rank}${r.newBest ? ' · New personal best!' : ''}`,
      error: `Couldn't post your score (${r.message}).`,
    }[r.phase];
    if (this.runText !== text) { this.runText = text; this.el['run-status'].textContent = text; }
  }

  toast(message) {
    if (!message) return;
    this.el.toast.textContent = message;
    this.el.toast.classList.remove('is-on');
    void this.el.toast.offsetWidth;
    this.el.toast.classList.add('is-on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('is-on'), 2300);
  }
}
