import html from './grtm.html?raw'
import css  from './grtm.css?inline'

export default {
  id:          'grtm',
  isVideoSlide: true,
  narration:   ``,
  html,
  css,
  init(el) {
    const vid      = el.querySelector('#seedance-video');
    const tap      = el.querySelector('#grtmTap');
    const unmute   = el.querySelector('#grtmUnmute');
    const progFill = el.querySelector('#grtmProgFill');
    if (!vid) return;

    tap.addEventListener('click', () => {
      if (vid.paused) vid.play().catch(() => {});
      else vid.pause();
    });

    unmute.addEventListener('click', (e) => {
      e.stopPropagation();
      vid.muted = false;
      unmute.classList.add('hidden');
    });

    vid.addEventListener('timeupdate', () => {
      if (vid.duration) progFill.style.width = (vid.currentTime / vid.duration * 100) + '%';
    });

    vid.addEventListener('volumechange', () => {
      unmute.classList.toggle('hidden', !vid.muted);
    });

    // On slide activation: unmute, autoplay, and kill avatar narration.
    const avatarIframe = document.getElementById('avatar-pet');
    const stopAvatar = () => {
      if (avatarIframe && avatarIframe.contentWindow) {
        avatarIframe.contentWindow.postMessage({ type: 'stop' }, '*');
      }
    };

    const observer = new MutationObserver(() => {
      if (el.classList.contains('active')) {
        stopAvatar();
        vid.muted = false;
        vid.play().catch(() => {
          // Browser blocked unmuted autoplay — fall back to muted so the
          // user can tap the unmute pill.
          vid.muted = true;
          vid.play().catch(() => {});
        });
      } else {
        vid.pause();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  },
}
