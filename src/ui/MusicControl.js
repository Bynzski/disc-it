// Small speaker button; the volume slider slides out on hover / keyboard focus.
export class MusicControl {
  constructor(parent, music) {
    this.music = music;
    this.el = document.createElement('div');
    this.el.className = 'pg-music';
    this.el.innerHTML = `
      <button type="button" class="pg-chunk pg-music-btn" aria-label="Mute music" title="Mute music (M)" aria-keyshortcuts="m" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" fill="currentColor"/>
          <path class="pg-music-waves" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>
          <path class="pg-music-x" d="m15.5 9.5 5 5m0-5-5 5"/>
        </svg>
      </button>
      <label class="pg-chunk pg-music-slider"><span class="pg-sr">Music volume</span><input type="range" min="0" max="100" step="1" aria-label="Music volume"></label>`;
    parent.appendChild(this.el);
    this.button = this.el.querySelector('button');
    this.slider = this.el.querySelector('input');
    this.button.addEventListener('click', () => { music.start(); music.toggleMute(); });
    this.slider.addEventListener('input', () => { music.start(); music.setVolume(this.slider.value / 100); });
    music.subscribe(({ volume, muted }) => {
      this.el.classList.toggle('is-muted', muted);
      this.button.setAttribute('aria-pressed', String(muted));
      this.button.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
      this.button.title = muted ? 'Unmute music (M)' : 'Mute music (M)';
      this.slider.value = muted ? 0 : Math.round(volume * 100);
    });
  }
}
