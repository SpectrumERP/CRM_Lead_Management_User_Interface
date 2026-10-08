/**
 * Indeterminate loading indicator. Prefer this over ad-hoc CSS spinners.
 * `label` is announced to assistive tech (visual spinner stays decorative).
 */
export interface SpinnerProps {
  /** Accessible status text. Not shown visually. */
  label?: string
}

export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return <div className="ui-spinner" role="status" aria-live="polite" aria-label={label} />
}

export interface PageLoaderProps {
  label?: string
  /** `main` covers the content pane (below header, beside sidebar); `page` covers the viewport. */
  cover?: 'main' | 'page'
}

/** Branded overlay used for route transitions and lazy page loads. */
export function PageLoader({ label = 'Loading', cover = 'main' }: PageLoaderProps) {
  const shell =
    cover === 'page'
      ? 'fixed inset-0 z-[80]'
      : 'fixed inset-x-0 top-14 bottom-0 z-30 lg:left-56'
  return (
    <div
      className={`${shell} page-loader-scrim grid place-items-center`}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-primary-soft">
        <div className="page-loader-bar h-full" />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 p-4">
        <div className="page-loader-mark" aria-hidden>
          <span className="page-loader-halo" />
          <span className="page-loader-ring" />
          <span className="page-loader-core">FI</span>
        </div>
        <p className="font-display text-xs font-semibold text-ink">{label}</p>
      </div>
    </div>
  )
}

export interface FullPageSpinnerProps {
  label?: string
}

/** Centered branded loader for route/auth waits. */
export function FullPageSpinner({ label }: FullPageSpinnerProps) {
  return <PageLoader cover="page" label={label} />
}

export interface BootShellProps {
  label?: string
}

/**
 * App chrome placeholder — blue sidebar, white header, loader in the content area.
 * Same paint as the boot markup in index.html (styles live there), so a session check
 * after switching between the CRM and Task apps never flashes a blank or full-screen page.
 */
export function BootShell({ label = 'Loading' }: BootShellProps) {
  return (
    <div className="boot-shell" role="status" aria-busy="true" aria-live="polite" aria-label={label}>
      <div className="boot-side" />
      <div className="boot-main">
        <div className="boot-head" />
        <div className="boot-body">
          <div className="crm-boot-track" aria-hidden="true">
            <div className="crm-boot-bar" />
          </div>
          <div className="crm-boot-body">
            <div className="crm-boot-mark" aria-hidden="true">
              <span className="crm-boot-halo" />
              <span className="crm-boot-ring" />
              <span className="crm-boot-core">FI</span>
            </div>
            <p className="crm-boot-label">{label}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
