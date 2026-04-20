import html from './tension.html?raw'
import css  from './tension.css?inline'

const SHOTS = [
  'photo_2026-04-20_09-56-21.jpg',
  'photo_2026-04-20_09-56-53.jpg',
  'photo_2026-04-20_09-56-56.jpg',
  'photo_2026-04-20_09-56-59.jpg',
  'photo_2026-04-20_09-57-03.jpg',
  'photo_2026-04-20_09-57-06.jpg',
  'photo_2026-04-20_09-57-08.jpg',
  'photo_2026-04-20_09-57-11.jpg',
  'photo_2026-04-20_09-57-14.jpg',
  'photo_2026-04-20_09-57-16.jpg',
  'photo_2026-04-20_09-57-19.jpg',
  'photo_2026-04-20_09-57-22.jpg',
  'photo_2026-04-20_09-57-25.jpg',
  'photo_2026-04-20_09-57-27.jpg',
  'photo_2026-04-20_09-57-30.jpg',
  'photo_2026-04-20_09-57-32.jpg',
  'photo_2026-04-20_09-57-35.jpg',
  'photo_2026-04-20_09-57-38.jpg',
  'photo_2026-04-20_09-57-40.jpg',
  'photo_2026-04-20_09-57-43.jpg',
  'photo_2026-04-20_09-57-45.jpg',
  'photo_2026-04-20_09-57-47.jpg',
  'photo_2026-04-20_09-57-50.jpg',
  'photo_2026-04-20_09-57-52.jpg',
  'photo_2026-04-20_09-57-55.jpg',
  'photo_2026-04-20_09-57-58.jpg',
  'photo_2026-04-20_09-58-00.jpg',
  'photo_2026-04-20_09-58-03.jpg',
  'photo_2026-04-20_09-58-05.jpg',
  'photo_2026-04-20_09-58-08.jpg',
  'photo_2026-04-20_09-58-11.jpg',
  'photo_2026-04-20_09-58-13.jpg',
  'photo_2026-04-20_09-58-16.jpg',
  'photo_2026-04-20_09-58-19.jpg',
];

const CARD_COUNT = 112;
const OUTRO_AT = 5.6;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default {
  id: 'tension',
  narration: `To act on a single headline today, you leave the stream — four apps, twelve clicks, and the world has already moved. The interface hasn't caught up to the world it shows you.`,
  html,
  css,
  init(el) {
    const stage  = el.querySelector('#tensionStage');

    let rafId   = 0;
    let startAt = 0;
    let built   = false;

    function buildCards() {
      stage.innerHTML = '';
      const rnd = mulberry32(0xC0FFEE);
      const frag = document.createDocumentFragment();

      for (let i = 0; i < CARD_COUNT; i++) {
        const file = SHOTS[i % SHOTS.length];
        const t    = i / (CARD_COUNT - 1);

        // Earlier cards cluster near center, later cards spread toward edges.
        const spreadX = 12 + t * 34;
        const spreadY = 10 + t * 30;
        const x = 50 + (rnd() - 0.5) * 2 * spreadX;
        const y = 52 + (rnd() - 0.5) * 2 * spreadY;

        const rot = (rnd() - 0.5) * 26;
        const scl = 0.52 + rnd() * 0.42;
        const alert = rnd() < 0.18;

        const card = document.createElement('div');
        card.className = 'tscrn' + (alert ? ' tscrn-alert' : '');
        card.style.left = `${x}%`;
        card.style.top  = `${y}%`;
        card.style.setProperty('--rot', `${rot}deg`);
        card.style.setProperty('--scl', scl.toFixed(3));
        card.style.setProperty('--i', i);
        card.style.zIndex = 100 + i;
        card.innerHTML = `
          <div class="tscrn-chrome">
            <span class="tscrn-dot"></span><span class="tscrn-dot"></span><span class="tscrn-dot"></span>
          </div>
          <img class="tscrn-img" src="/assets/tension/${file}" loading="lazy" alt="">
        `;
        frag.appendChild(card);
      }
      stage.appendChild(frag);
      built = true;
    }

    function run() {
      if (!built) buildCards();

      el.classList.remove('tension-running', 'tension-ended');
      // Force reflow so animation restarts cleanly.
      void stage.offsetWidth;
      el.classList.add('tension-running');

      cancelAnimationFrame(rafId);
      startAt = performance.now();
      let outroFired = false;

      const loop = (now) => {
        const t = (now - startAt) / 1000;
        if (!outroFired && t >= OUTRO_AT) {
          outroFired = true;
          el.classList.add('tension-ended');
        }
        if (t < 10) {
          rafId = requestAnimationFrame(loop);
        }
      };
      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      cancelAnimationFrame(rafId);
    }

    // Replay each time the slide becomes active.
    el.addEventListener('transitionend', (e) => {
      if (e.target !== el || e.propertyName !== 'opacity') return;
      if (el.classList.contains('active')) run();
      else stop();
    });

    buildCards();

    // Mobile: no active-class transition, so kick off once after mount.
    if (window.matchMedia('(max-width: 768px)').matches) {
      requestAnimationFrame(() => run());
    }
  },
}
