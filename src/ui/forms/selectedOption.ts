/**
 * Dropdown helpers: open on the selected option, and keep it visible in the scrolling list.
 */

/** Index to highlight when a list opens: the selected option (when not searching), else the first. */
export function initialFocusIndex<T>(items: readonly T[], selectedKey: string | null, getKey: (item: T) => string, searching: boolean): number {
  if (searching || selectedKey === null) return 0
  const idx = items.findIndex((item) => getKey(item) === selectedKey)
  return idx >= 0 ? idx : 0
}

/** Scroll the list so its `aria-selected="true"` option sits in view (centred when it was hidden). */
export function scrollSelectedIntoView(list: HTMLElement | null) {
  const option = list?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!list || !option) return
  const listRect = list.getBoundingClientRect()
  const rect = option.getBoundingClientRect()
  if (rect.top >= listRect.top && rect.bottom <= listRect.bottom) return
  list.scrollTop += rect.top - listRect.top - (listRect.height - rect.height) / 2
}
