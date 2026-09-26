import type { SyntheticEvent } from 'react'

/** Stop a React event from bubbling to parent clickable rows/cards. */
export function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

/** Spread onto nested interactive nodes inside clickable containers. */
export const stopBubbleProps = {
  onClick: stopPropagation,
  onKeyDown: stopPropagation,
} as const
