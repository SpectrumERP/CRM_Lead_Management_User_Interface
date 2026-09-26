import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Surface container (white card, token border/radius/shadow).
 * Layout chrome only — keep CRM data fetching in pages/contexts, not here.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
