import type { ReactNode } from 'react'

export interface FormGridProps {
  cols?: 1 | 2 | 3
  className?: string
  children: ReactNode
}

const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-3',
} as const

/** Responsive field grid. Place `Field` / `*Field` children inside. */
export function FormGrid({ cols = 2, className = '', children }: FormGridProps) {
  return <div className={`grid gap-4 ${COLS[cols]} ${className}`.trim()}>{children}</div>
}
