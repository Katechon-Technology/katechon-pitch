import html from './video.html?raw'
import css  from './video.css?inline'

const YT_ID = 'x7HaITeN0tA'
// Preload muted + autoplay so the player is already warm when the slide activates.
const YT_SRC = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`

export default {
  id:        'video',
  isVideoSlide: true,
  narration: ``,
  html,
  css,
  init(el) {
    const iframe = el.querySelector('iframe')
    iframe.src = YT_SRC

    const send = (func) => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*'
      )
    }

    const observer = new MutationObserver(() => {
      if (el.classList.contains('active')) {
        send('unMute')
        send('playVideo')
      } else {
        send('pauseVideo')
        send('mute')
      }
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
  },
}
