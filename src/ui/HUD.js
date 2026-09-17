import './style.css';
import { DISCS } from '../entities/Disc.js';

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

export class HUD {
  constructor({ holes, onStartRound, onRestart, onToggleView, onSelectDisc, onReleaseMouse, onNextHole, onTouchControl, onTouchThrowStart, onTouchThrowEnd, onTouchThrowCancel, onTouchFlat }) {
    this.holes = holes;
    this.root = document.createElement('div');
    this.root.className = 'pg-root';
    this.root.innerHTML = `
      <div class="pg-vignette"></div>
      <header class="pg-topbar">
        <div class="pg-course pg-glass">
          <div class="pg-hole-number" id="pg-hole-number">01</div>
          <div>
            <div class="pg-eyebrow">TOCOBAGA PARK</div>
            <h1 id="pg-hole-name">No. 1</h1>
            <div class="pg-meta" id="pg-hole-meta">Par 3 · 282 ft</div>
          </div>
        </div>
        <div class="pg-stats pg-glass" aria-label="Hole statistics">
          <div><span class="pg-eyebrow">THROWS</span><b id="pg-throws">0</b></div>
          <div><span class="pg-eyebrow">TO BASKET</span><b id="pg-distance">282 <small>ft</small></b></div>
        </div>
      </header>

      <div class="pg-crosshair" id="pg-crosshair" aria-label="Throw direction">
        <div class="pg-reticle"></div>
        <div class="pg-tilt-disc" id="pg-tilt-disc"><i></i></div>
        <div class="pg-aim-label"><b id="pg-cross-angle">0° Flat</b><span>SCROLL · TILT</span></div>
      </div>

      <section class="pg-panel pg-glass" aria-label="Shot setup">
        <div class="pg-panel-heading"><span class="pg-eyebrow">DISC BAG</span><span id="pg-disc-ratings" title="Speed / glide / turn / fade"></span></div>
        <div class="pg-disc-selector" role="group" aria-label="Choose disc">
          ${Object.entries(DISCS).map(([type, disc], index) => `
            <button type="button" data-disc="${type}" aria-keyshortcuts="${index + 1}" aria-pressed="false" title="${disc.description}" style="--disc-color:${disc.color}">
              <kbd>${index + 1}</kbd><span>${disc.name}</span>
            </button>
          `).join('')}
        </div>
        <div class="pg-shot-row"><span>Elevation <b id="pg-elevation">0°</b></span><span id="pg-power-value">POWER 0%</span></div>
        <div class="pg-power" role="progressbar" aria-label="Throw power" aria-valuemin="0" aria-valuemax="100"><div id="pg-power-fill"></div></div>
        <div class="pg-shot-footer"><span><kbd>LMB</kbd> <span id="pg-throw-label">Hold / release</span></span><span class="pg-status" id="pg-status">READY</span></div>
      </section>

      <nav class="pg-actions pg-glass" aria-label="Game actions">
        <button type="button" id="pg-view-toggle" aria-keyshortcuts="v" aria-pressed="false" title="Toggle elevated inspection view"><kbd>V</kbd><span id="pg-view-label">Elevated</span></button>
        <button type="button" id="pg-restart" aria-keyshortcuts="r" title="Restart this hole"><kbd>R</kbd> Restart</button>
        <button type="button" id="pg-cursor" aria-keyshortcuts="Escape" title="Release mouse capture"><kbd>Esc</kbd> Cursor</button>
      </nav>

      <section class="pg-touch-controls" aria-label="Touch controls">
        <div class="pg-touch-stack pg-glass">
          <div class="pg-touch-aim-hint">Drag screen to aim</div>
          <div class="pg-touch-tilt" aria-label="Disc tilt controls">
            <button type="button" class="pg-touch-button" data-touch-control="tilt-anhyzer" aria-label="Tilt anhyzer">ANHYZER</button>
            <button type="button" id="pg-touch-flat" class="pg-touch-button" aria-label="Reset disc tilt">FLAT</button>
            <button type="button" class="pg-touch-button" data-touch-control="tilt-hyzer" aria-label="Tilt hyzer">HYZER</button>
          </div>
          <button type="button" id="pg-touch-throw" class="pg-touch-throw" aria-label="Hold to set power, release to throw"><span>HOLD</span><b>POWER</b><em id="pg-touch-power">0%</em></button>
        </div>
      </section>
      <div class="pg-capture-hint" id="pg-capture-hint">Click course to aim</div>
      <div class="pg-toast" id="pg-toast" role="status"></div>

      <section class="pg-landing" id="pg-landing" role="dialog" aria-modal="true" aria-labelledby="pg-landing-title">
        <header class="pg-title-brand">
          <h2 id="pg-landing-title">Disc It<span aria-hidden="true">.</span></h2>
          <div class="pg-title-subtitle">PARK DISC GOLF</div>
        </header>
        <div class="pg-title-menu">
          <div class="pg-title-dock" aria-label="Course selection">
            <div class="pg-title-course">
              <span class="pg-title-selected"><i aria-hidden="true"></i> SELECTED COURSE</span>
              <h3>Tocobaga Park</h3>
              <p>${holes.length} Holes <span>•</span> Par ${holes.reduce((sum, h) => sum + h.par, 0)} <span>•</span> ${holes.reduce((sum, h) => sum + h.lengthFeet, 0)} ft</p>
            </div>
            <button type="button" id="pg-start-round" class="pg-title-play" aria-keyshortcuts="Enter Space" aria-label="Play course: Tocobaga Park">Play Course <span aria-hidden="true">→</span></button>
          </div>
          <div class="pg-title-future" aria-disabled="true">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
            More courses <span>Coming soon</span>
          </div>
        </div>
      </section>

      <div class="pg-final" id="pg-final" hidden role="dialog" aria-modal="true" aria-labelledby="pg-final-title">
        <div class="pg-final-card pg-glass">
          <div class="pg-eyebrow" id="pg-final-eyebrow">TOCOBAGA · HOLE 01</div>
          <h2 id="pg-final-title">Hole complete</h2>
          <div class="pg-final-result" id="pg-final-result">PAR</div>
          <p id="pg-final-score"></p>
          <div class="pg-score-scroll" tabindex="0" role="region" aria-label="18-hole scorecard; scroll horizontally for all holes"><table class="pg-scorecard" id="pg-scorecard">
            <thead><tr><th></th>${holes.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>TOT</th></tr></thead>
            <tbody>
              <tr><th scope="row">Par</th>${holes.map(h => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((sum, h) => sum + h.par, 0)}</td></tr>
              <tr><th>Score</th>${holes.map(() => '<td class="pg-score-cell">–</td>').join('')}<td class="pg-total" id="pg-score-total">–</td></tr>
            </tbody></table></div>
          <p class="pg-score-hint">Scroll scorecard to view all 18 holes →</p>
          <div class="pg-final-actions">
            <button type="button" id="pg-next" aria-keyshortcuts="n"><kbd>N</kbd> Next hole</button>
            <button type="button" id="pg-final-restart" aria-keyshortcuts="r"><kbd>R</kbd> Replay</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);
    const get = id => this.root.querySelector(`#pg-${id}`);
    this.el = Object.fromEntries([
      'hole-number', 'hole-name', 'hole-meta', 'throws', 'distance', 'crosshair', 'cross-angle',
      'tilt-disc', 'disc-ratings', 'elevation', 'power-value', 'power-fill', 'throw-label',
      'status', 'view-toggle', 'view-label', 'restart', 'cursor', 'capture-hint',
      'touch-throw', 'touch-power', 'touch-flat', 'toast', 'landing', 'start-round', 'final', 'final-eyebrow', 'final-result', 'final-score', 'final-restart', 'next', 'scorecard', 'score-total', 'final-title',
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
    this.el.next.addEventListener('click', () => onNextHole?.());
    this.el['start-round'].addEventListener('click', () => onStartRound?.());

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
    const profile = DISCS[data.discType];
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
    this.el['hole-number'].textContent = String(hole.id).padStart(2, '0');
    this.el['hole-name'].textContent = hole.name;
    this.el['hole-meta'].textContent = `Par ${hole.par} · ${hole.lengthFeet} ft`;
    this.el.throws.textContent = data.throws;
    this.el.distance.innerHTML = `${Math.max(0, Math.round(data.distanceFeet))} <small>ft</small>`;
    this.el.elevation.textContent = `${Math.round(data.elevationDeg)}°`;
    this.el['cross-angle'].textContent = data.releaseLabel === 'Flat' ? '0° Flat' : data.releaseLabel;
    this.el['tilt-disc'].style.transform = `translate(-50%, -50%) rotate(${-data.releaseDeg || 0}deg)`;
    this.el.crosshair.hidden = isLanding || data.mode !== 'aiming' || data.finished;
    const power = Math.round(data.power * 100);
    this.root.style.setProperty('--touch-power', `${power}%`);
    this.el['power-fill'].style.width = `${power}%`;
    this.powerBar.setAttribute('aria-valuenow', power);
    this.el['power-value'].textContent = `POWER ${power}%`;
    this.el['touch-power'].textContent = `${power}%`;
    this.el['throw-label'].textContent = data.charging ? 'Release to throw' : 'Hold / release';
    this.el.status.textContent = data.finished ? 'COMPLETE' : data.mode === 'flying' ? 'IN FLIGHT' : data.charging ? (data.powerRising ? '↑ RISING' : '↓ FALLING') : 'READY';
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
    this.el['final-eyebrow'].textContent = `TOCOBAGA · HOLE ${String(hole.id).padStart(2, '0')}`;
    const isLast = data.holeIndex + 1 >= data.holeCount;
    this.el.next.textContent = '';
    this.el.next.innerHTML = isLast
      ? `<kbd>N</kbd> New round`
      : `<kbd>N</kbd> Next: No. ${data.holes[data.holeIndex + 1].id}`;
    const roundComplete = data.finished && data.roundOver;
    this.el.final.classList.toggle('is-round-complete', roundComplete);
    this.el.scorecard.hidden = !roundComplete;
    this.el['final-title'].textContent = roundComplete ? 'Round complete' : 'Hole complete';
    this.el['final-restart'].innerHTML = `<kbd>R</kbd> Replay hole ${hole.id}`;
    if (data.finished) {
      const total = data.scores.reduce((sum, score) => sum + (score ?? 0), 0);
      const par = roundComplete ? data.holes.reduce((sum, h) => sum + h.par, 0) : hole.par;
      const throws = roundComplete ? total : data.throws;
      const diff = throws - par;
      const relative = diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff}`;
      this.el['final-eyebrow'].textContent = roundComplete ? 'TOCOBAGA PARK · ROUND SCORECARD' : `TOCOBAGA · HOLE ${hole.id}`;
      this.el['final-result'].textContent = roundComplete ? relative : resultLabel(throws, par);
      this.el['final-score'].textContent = `${throws} throws · Par ${par} · ${relative}`;
      this.scoreCells.forEach((cell, i) => {
        const score = data.scores[i];
        cell.textContent = score ?? '–';
        cell.className = `pg-score-cell ${score === null ? '' : score < data.holes[i].par ? 'under' : score > data.holes[i].par ? 'over' : 'even'}`;
      });
      this.el['score-total'].textContent = total;
    }
  }

  toast(message) {
    if (!message) return;
    this.el.toast.textContent = message;
    this.el.toast.classList.add('is-on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('is-on'), 2300);
  }
}
