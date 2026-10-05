/**
 * Marks every `.table-scroll` with `is-scrolled-start` / `is-scrolled-end` while columns are hidden
 * on that side, so pinned columns show their edge shadow only when something scrolls under them
 * (see index.css). Installed once for the whole app; tables need no code of their own.
 */
const SELECTOR = '.table-scroll'

function update(el: Element) {
  const start = el.scrollLeft > 0
  const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  el.classList.toggle('is-scrolled-start', start)
  el.classList.toggle('is-scrolled-end', end)
}

export function installTableScrollEdges(): () => void {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return () => {}
  const watched = new WeakSet<Element>()

  // Layout reads batched into one frame — DOM changes can arrive many times per render.
  const dirty = new Set<Element>()
  let frame = 0
  function schedule(el: Element) {
    dirty.add(el)
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0
        dirty.forEach(update)
        dirty.clear()
      })
    }
  }

  // Size changes of the container or its table (rows, columns, window) change what is hidden.
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target.closest(SELECTOR)
      if (el) schedule(el)
    }
  })

  function watch(el: Element) {
    if (watched.has(el)) return
    watched.add(el)
    resize.observe(el)
    const table = el.querySelector('table')
    if (table) resize.observe(table)
    schedule(el)
  }

  function scan(root: ParentNode) {
    if (root instanceof Element && root.matches(SELECTOR)) watch(root)
    root.querySelectorAll(SELECTOR).forEach(watch)
  }

  // Scroll does not bubble; capture catches it from every table.
  function onScroll(event: Event) {
    const el = event.target
    if (el instanceof Element && el.matches(SELECTOR)) update(el)
  }

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node)
      })
      // A table rendered into an existing container.
      const container = record.target instanceof Element ? record.target.closest(SELECTOR) : null
      if (container) {
        const table = container.querySelector('table')
        if (table) resize.observe(table)
        schedule(container)
      }
    }
  })

  scan(document)
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  mutations.observe(document.body, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true })
    mutations.disconnect()
    resize.disconnect()
    cancelAnimationFrame(frame)
  }
}
