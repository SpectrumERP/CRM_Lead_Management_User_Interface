/**
 * Grids scroll in a `.table-scroll` box with a sticky header row. The vertical scrollbar should run beside
 * the rows only, not the header: each box gets its header height as `--table-head-h`, and index.css starts
 * the scrollbar track below it (`::-webkit-scrollbar-track { margin-top }`). Headers are measured again
 * when they resize (wrapping labels, hidden columns) and new grids are picked up as pages change.
 */
const SCROLLER = '.table-scroll';

export function watchTableHeadScrollbars(root: HTMLElement = document.body): () => void {
  const observed = new WeakSet<Element>();

  const update = (scroller: HTMLElement) => {
    const head = scroller.querySelector('thead');
    const height = head ? Math.round(head.getBoundingClientRect().height) : 0;
    const value = `${height}px`;
    if (scroller.style.getPropertyValue('--table-head-h') !== value) scroller.style.setProperty('--table-head-h', value);
  };

  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const scroller = entry.target.closest<HTMLElement>(SCROLLER);
      if (scroller) update(scroller);
    }
  });

  const scan = () => {
    for (const scroller of root.querySelectorAll<HTMLElement>(SCROLLER)) {
      const head = scroller.querySelector('thead');
      if (head && !observed.has(head)) {
        observed.add(head);
        resize.observe(head);
      }
      update(scroller);
    }
  };

  // Many DOM changes per frame (rows, lists): look for new grids at most once per frame.
  let frame = 0;
  const mutations = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scan();
    });
  });

  scan();
  mutations.observe(root, { childList: true, subtree: true });
  return () => {
    cancelAnimationFrame(frame);
    mutations.disconnect();
    resize.disconnect();
  };
}
