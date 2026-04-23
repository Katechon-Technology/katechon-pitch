import html from './howitworks.html?raw'
import css  from './howitworks.css?inline'

export default {
  id:         'howitworks',
  hideAvatar: true,
  narration:  ``,
  html,
  css,
  init(el) {
    const modals   = Array.from(el.querySelectorAll('.hiw-modal'))
    const hotspots = Array.from(el.querySelectorAll('.hiw-hotspot'))
    let modalIdx = -1

    function render() {
      modals.forEach((m, i) => m.classList.toggle('active', i === modalIdx))
      hotspots.forEach((h, i) => h.classList.toggle('active', i === modalIdx))
      el.dataset.modalActive = modalIdx >= 0 ? 'true' : 'false'
    }

    function open(idx)  { modalIdx = idx;  render() }
    function close()    { modalIdx = -1;   render() }

    hotspots.forEach((h) => {
      h.addEventListener('click', (e) => {
        e.stopPropagation()
        open(parseInt(h.dataset.zone, 10))
      })
    })

    // Click outside modal card (but inside slide) to close.
    el.addEventListener('click', (e) => {
      if (modalIdx < 0) return
      if (e.target.closest('.hiw-modal-card')) return
      if (e.target.closest('.hiw-hotspot')) return
      close()
    })

    // Intercept arrow/space at the capture phase so deck navigation only
    // advances once all three modals have been stepped through.
    document.addEventListener('keydown', (e) => {
      if (!el.classList.contains('active')) return
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' '
      const prev = e.key === 'ArrowLeft'  || e.key === 'ArrowUp'
      if (!next && !prev) return

      if (next) {
        if (modalIdx < modals.length - 1) {
          e.preventDefault()
          e.stopImmediatePropagation()
          open(modalIdx + 1)
        }
        // modalIdx === last: let the event bubble so the deck advances.
      } else if (prev) {
        if (modalIdx > -1) {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (modalIdx === 0) close(); else open(modalIdx - 1)
        }
        // modalIdx === -1: let bubble so deck goes to previous slide.
      }
    }, true)

    // Reset modal state when the slide is deactivated so a re-entry starts fresh.
    // (Deck handles play/pause on the <video> itself.)
    const observer = new MutationObserver(() => {
      if (!el.classList.contains('active')) close()
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
  },
}
