import html from './finale.html?raw'
import css  from './finale.css?inline'

export default {
  id:           'finale',
  isVideoSlide: true,
  narration:    ``,
  html,
  css,
  init(el) {
    const vid      = el.querySelector('#finale-video')
    const tap      = el.querySelector('#finaleTap')
    const unmute   = el.querySelector('#finaleUnmute')
    const progFill = el.querySelector('#finaleProgFill')
    if (!vid) return

    tap.addEventListener('click', () => {
      if (vid.paused) vid.play().catch(() => {})
      else vid.pause()
    })

    unmute.addEventListener('click', (e) => {
      e.stopPropagation()
      vid.muted = false
      unmute.classList.add('hidden')
    })

    vid.addEventListener('timeupdate', () => {
      if (vid.duration) progFill.style.width = (vid.currentTime / vid.duration * 100) + '%'
    })

    vid.addEventListener('volumechange', () => {
      unmute.classList.toggle('hidden', !vid.muted)
    })

    const avatarIframe = document.getElementById('avatar-pet')
    const stopAvatar = () => {
      if (avatarIframe && avatarIframe.contentWindow) {
        avatarIframe.contentWindow.postMessage({ type: 'stop' }, '*')
      }
    }

    const observer = new MutationObserver(() => {
      if (el.classList.contains('active')) {
        stopAvatar()
        vid.muted = false
        vid.play().catch(() => {
          vid.muted = true
          vid.play().catch(() => {})
        })
      } else {
        vid.pause()
      }
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
  },
}
