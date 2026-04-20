import html from './evolution.html?raw'
import css  from './evolution.css?inline'

export default {
  id:        'evolution',
  narration: `Broadcast made us viewers, then social made us creators — each wave invisible from inside the one before. The third is forming now, and watching is about to become doing.`,
  html,
  css,
  init(el) {
    const carousel = el.querySelector('#evoCarousel');
    if (!carousel) return;
    const rows   = Array.from(carousel.querySelectorAll('.evo-row-item'));
    const dotEls = Array.from(el.querySelectorAll('.evo-dot'));
    const len    = rows.length;
    let active   = 1;
    let cooling  = false;

    function mod(n, m) { return ((n % m) + m) % m; }

    function layout() {
      const offsetPx = window.innerHeight * 0.46;
      const cur = mod(active, len);
      rows.forEach((row, i) => {
        let d = i - cur;
        if (d >  len / 2) d -= len;
        if (d < -len / 2) d += len;
        const abs = Math.abs(d);
        row.style.transform     = `translateY(${d * offsetPx}px) scale(${abs === 0 ? 1 : 0.5})`;
        row.style.opacity       = abs === 0 ? '1' : abs === 1 ? '0.25' : '0';
        row.style.pointerEvents = abs === 0 ? 'auto' : 'none';
        row.classList.toggle('active', abs === 0);
      });
      dotEls.forEach((dot, i) => dot.classList.toggle('active', i === cur));
    }

    function step(dir) {
      if (cooling) return;
      cooling = true;
      setTimeout(() => { cooling = false; }, 620);
      active += dir;
      layout();
    }

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    let touchY = 0;
    el.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1);
    }, { passive: true });

    dotEls.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        active = i;
        layout();
      });
    });

    // Reset to middle row when slide becomes active
    el.addEventListener('transitionend', (e) => {
      if (e.target === el && e.propertyName === 'opacity' && el.classList.contains('active')) {
        active = 1;
        layout();
      }
    });

    layout();
  },
}
