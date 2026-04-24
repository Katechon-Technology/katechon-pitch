import html from './founder.html?raw'
import css  from './founder.css?inline'

export default {
  id:         'founder',
  hideAvatar: true,
  narration:  ``,
  html,
  css,
  init(el) {
    const cols  = Array.from(el.querySelectorAll('.founder-row'))
    const LAST  = cols.length - 1  // index of final row for keyboard nav
    let colIdx = -1

    function render() {
      cols.forEach((c, i) => c.classList.toggle('active', i === colIdx))
      el.dataset.colActive = colIdx < 0 ? 'none' : String(colIdx)
    }

    function open(idx)  { colIdx = idx; render() }
    function close()    { colIdx = -1;  render() }

    // Clicking a column opens it; clicking the active column closes it.
    cols.forEach((c) => {
      c.addEventListener('click', (e) => {
        e.stopPropagation()
        const i = parseInt(c.dataset.col, 10)
        if (colIdx === i) close(); else open(i)
      })
    })

    // Click outside any row (on the background) closes.
    el.addEventListener('click', (e) => {
      if (colIdx < 0 || colIdx >= VIDEO) return
      if (e.target.closest('.founder-row')) return
      close()
    })

    // Intercept keyboard at capture phase so deck only advances after the full
    // sequence has been stepped through: col 0 → col 1 → col 2 → video → next slide.
    document.addEventListener('keydown', (e) => {
      if (!el.classList.contains('active')) return
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' '
      const prev = e.key === 'ArrowLeft'  || e.key === 'ArrowUp'
      if (!next && !prev) return

      if (next) {
        if (colIdx < LAST) {
          e.preventDefault()
          e.stopImmediatePropagation()
          open(colIdx + 1)  // -1→0, 0→1, 1→2
        }
        // colIdx === LAST: let bubble so deck advances to next slide
      } else if (prev) {
        if (colIdx > -1) {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (colIdx === 0) close(); else open(colIdx - 1)  // 2→1, 1→0, 0→close
        }
        // colIdx === -1: let bubble so deck goes to previous slide
      }
    }, true)

    // Reset when the slide is deactivated so re-entry starts fresh.
    const observer = new MutationObserver(() => {
      if (!el.classList.contains('active')) close()
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })

    // Set initial attribute state immediately.
    render()

  },
}
