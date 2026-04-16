import html from './stack.html?raw'
import css  from './stack.css?inline'

const isMobile = window.matchMedia('(max-width: 768px)').matches;

export default {
  id:        'stack',
  narration: `Our stack combines API data, avatar narration, and market predictions through a synthesis layer that generates infinite content streams — from war correspondents to AI versus AI Factorio.`,
  html,
  css,
  init(el) {
    const arc = el.querySelector('#streamArc');
    if (!arc) return;
    const arcItems = Array.from(arc.querySelectorAll('.stream-arc-item'));
    const arcLen = arcItems.length;
    let arcActive = 6; // "AI vs AI Factorio" starts active
    const arcRadius = 320;
    const arcCenter = 200;
    const visibleRange = 6;

    function mod(n, m) { return ((n % m) + m) % m; }

    function layoutArc() {
      arcItems.forEach((item, i) => {
        let offset = i - mod(arcActive, arcLen);
        if (offset > arcLen / 2) offset -= arcLen;
        if (offset < -arcLen / 2) offset += arcLen;
        const absOff = Math.abs(offset);

        if (absOff > visibleRange) {
          item.style.opacity = '0';
          item.style.pointerEvents = 'none';
          return;
        }

        const angle = offset * 12 * (Math.PI / 180);
        const y = arcCenter + Math.sin(angle) * arcRadius - 22;
        const x = (1 - Math.cos(angle)) * arcRadius * 0.35;
        const scale = 1 - absOff * 0.08;
        const opacity = absOff === 0 ? 1 : Math.max(0.15, 1 - absOff * 0.18);

        item.style.transform = `translateX(${x}px) scale(${scale})`;
        item.style.top = `${y}px`;
        item.style.opacity = String(opacity);
        item.style.pointerEvents = absOff === 0 ? 'auto' : 'none';
        item.classList.toggle('active', absOff === 0);
      });
    }

    if (isMobile) {
      setInterval(() => { arcActive++; layoutArc(); }, 3000);
    } else {
      arc.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        arcActive += e.deltaY > 0 ? 1 : -1;
        layoutArc();
      }, { passive: false });
    }

    layoutArc();
  },
}
