import html from './lineup.html?raw'
import css  from './lineup.css?inline'

const STORAGE_KEY = 'katechon-lineup-positions';
const DEFAULTS = [
  { scale: 0.23,  yFactor: 1.22 },
  { scale: 0.755, yFactor: 1.25 },
  { scale: 0.675, yFactor: 1.20 },
];

export default {
  id:        'lineup',
  hideAvatar: true,
  narration: ``,
  html,
  css,

  init(el) {
    const cols    = Array.from(el.querySelectorAll('.lineup-col'));
    const iframes = cols.map(c => c.querySelector('.lineup-iframe'));
    const ready   = [false, false, false];
    const cache   = [null, null, null];
    let active    = -1;

    // Apply saved positions when each iframe reports ready
    let positions = structuredClone(DEFAULTS);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length === 3) positions = saved;
    } catch {}

    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'avatar-ready') return;
      const i = iframes.findIndex(f => f?.contentWindow === e.source);
      if (i === -1) return;
      ready[i] = true;
      iframes[i].contentWindow.postMessage(
        { type: 'tune', scale: positions[i].scale, yFactor: positions[i].yFactor }, '*'
      );
    });

    async function loadAudio(i) {
      if (cache[i]) return cache[i];
      try {
        const r = await fetch(`/assets/narration/lineup-${i}.json`);
        if (!r.ok) return null;
        cache[i] = await r.json();
        return cache[i];
      } catch { return null; }
    }

    function stopAll() {
      iframes.forEach(f => f?.contentWindow?.postMessage({ type: 'stop' }, '*'));
    }

    async function open(i) {
      stopAll();
      active = i;
      cols.forEach((c, j) => c.classList.toggle('active', j === i));
      el.dataset.active = String(i);
      const payload = await loadAudio(i);
      if (payload) iframes[i]?.contentWindow?.postMessage(payload, '*');
    }

    function close() {
      stopAll();
      active = -1;
      cols.forEach(c => c.classList.remove('active'));
      delete el.dataset.active;
    }

    cols.forEach((col) => {
      col.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(col.dataset.col, 10);
        if (active === i) close(); else open(i);
      });
    });

    el.addEventListener('click', () => { if (active >= 0) close(); });

    // Keyboard nav: step through cols then let deck advance
    document.addEventListener('keydown', (e) => {
      if (!el.classList.contains('active')) return;
      const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ';
      const bwd = e.key === 'ArrowLeft'  || e.key === 'ArrowUp';
      if (!fwd && !bwd) return;

      if (fwd) {
        if (active < cols.length - 1) {
          e.preventDefault(); e.stopImmediatePropagation();
          open(active + 1);
        }
        // active === last col → fall through so deck advances
      } else {
        if (active > -1) {
          e.preventDefault(); e.stopImmediatePropagation();
          active === 0 ? close() : open(active - 1);
        }
      }
    }, true);

    // Reset on slide deactivation
    const obs = new MutationObserver(() => {
      if (!el.classList.contains('active')) close();
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });

    // Preload audio for all three
    cols.forEach((_, i) => loadAudio(i));
  },
}
