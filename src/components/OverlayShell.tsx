import { type ReactNode } from 'react'
import FormDrawer from './FormDrawer'

export interface OverlayShellProps {
  title: string
  subtitle?: string
  onClose: () => void
  widthClass?: string
  children: ReactNode | ((requestClose: () => void) => ReactNode)
}

/** Quick-create and other large forms — right sheet via FormDrawer. */
export default function OverlayShell({
  title,
  subtitle,
  onClose,
  widthClass = 'w-full max-w-3xl',
  children,
}: OverlayShellProps) {
  return (
    <FormDrawer title={title} subtitle={subtitle} onClose={onClose} widthClass={widthClass}>
      {children}
    </FormDrawer>
  )
}
