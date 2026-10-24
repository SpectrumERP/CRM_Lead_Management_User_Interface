import { useState, type CSSProperties, type ReactNode } from "react"

/*
 * What the CRM shows while content is on its way: the shape of what is coming, with one band of light passing over
 * it (.skeleton in index.css), instead of a spinner. Screen readers hear the label (role="status"); with reduced
 * motion the shapes stay still. Each screen's shape follows its real layout, so nothing jumps when it arrives.
 */

/** One pass of the light, in ms: index.css's skeleton-sweep and index.html's boot-sweep last as long. */
const SKELETON_PERIOD = 2000

/**
 * Where the light is now, as a negative animation delay: a bar that mounts late starts mid-sweep, in step with the
 * bars already on screen and with index.html's loading screen, instead of starting a sweep of its own (a flicker).
 * The clock is the one CSS animations run on (document.timeline). Read once per bar: a delay that changed on a
 * re-render would make its light jump.
 */
export function useSkeletonPhase(): CSSProperties {
  const [phase] = useState(() => {
    // No document outside a browser (a test, a server render): the phase is then 0.
    const now =
      typeof document === "undefined"
        ? 0
        : Number(document.timeline?.currentTime ?? performance.now())
    return {
      "--skeleton-phase": `-${Math.round(now % SKELETON_PERIOD)}ms`,
    } as CSSProperties
  })
  return phase
}

export interface SkeletonProps {
  /** Size and shape with classes (h-3 w-24 rounded-lg…) or `style`. */
  className?: string
  style?: CSSProperties
  /** On the blue sidebar. */
  onDark?: boolean
}

/** One bar. Decorative: the status around it announces the loading. */
export function Skeleton({
  className = "h-3 w-full",
  style,
  onDark = false,
}: SkeletonProps) {
  const phase = useSkeletonPhase()
  return (
    <span
      aria-hidden
      className={`skeleton ${
        onDark ? "skeleton-on-dark" : ""
      } ${className}`.trim()}
      style={{ ...phase, ...style }}
    />
  )
}

export interface SkeletonStatusProps {
  /** Announced to assistive tech. */
  label?: string
  className?: string
  children: ReactNode
}

/** The live status every skeleton shape sits in. */
export function SkeletonStatus({
  label = "Loading",
  className = "",
  children,
}: SkeletonStatusProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

const LINE_WIDTHS = [92, 76, 84, 64, 70]

export interface SkeletonLinesProps {
  lines?: number
  label?: string
  className?: string
}

/** A few lines of text (a note, a detail, a description). */
export function SkeletonLines({
  lines = 3,
  label,
  className = "space-y-2.5 py-2",
}: SkeletonLinesProps) {
  return (
    <SkeletonStatus label={label} className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%` }}
        />
      ))}
    </SkeletonStatus>
  )
}

export interface SkeletonListProps {
  rows?: number
  /** A leading tile: `circle` (a person, a timeline dot), `square` (a file, a record). */
  lead?: "circle" | "square" | "dot" | "none"
  /** Lines per row. */
  lines?: 1 | 2 | 3
  label?: string
  className?: string
  /** Each row's own classes (padding, divider). */
  rowClassName?: string
}

/** Rows of a list: search results, attachments, a timeline, activities. */
export function SkeletonList({
  rows = 4,
  lead = "square",
  lines = 2,
  label,
  className = "space-y-1",
  rowClassName = "flex items-start gap-3 px-1 py-2",
}: SkeletonListProps) {
  return (
    <SkeletonStatus label={label} className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={rowClassName}>
          {lead === "circle" ? (
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          ) : null}
          {lead === "square" ? (
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          ) : null}
          {lead === "dot" ? (
            <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <Skeleton
              className="h-3"
              style={{ width: `${[62, 48, 70, 54][i % 4]}%` }}
            />
            {lines > 1 ? (
              <Skeleton
                className="h-2.5"
                style={{ width: `${[38, 30, 44, 34][i % 4]}%` }}
              />
            ) : null}
            {lines > 2 ? (
              <Skeleton
                className="h-2.5"
                style={{ width: `${[52, 44, 58, 40][i % 4]}%` }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </SkeletonStatus>
  )
}

export interface SkeletonOptionsProps {
  rows?: number
  label?: string
}

/** A dropdown's option rows while its list is on its way (a select that searches the server). */
export function SkeletonOptions({
  rows = 4,
  label = "Searching",
}: SkeletonOptionsProps) {
  return (
    <SkeletonList
      rows={rows}
      lead="none"
      lines={1}
      label={label}
      className="px-1 py-1"
      rowClassName="flex items-center px-2.5 py-2"
    />
  )
}

/** A field's shape: its label, then its control (an input's height). */
function FieldShape({ index }: { index: number }) {
  return (
    <div className="space-y-2">
      <Skeleton
        className="h-2.5"
        style={{ width: `${[28, 40, 34, 22][index % 4]}%` }}
      />
      <Skeleton className="h-9 w-full rounded-[var(--radius-control)]" />
    </div>
  )
}

export interface SkeletonFieldsProps {
  count?: number
  /** Columns from `sm` up, as in the form's FormGrid. */
  columns?: 1 | 2 | 3
  label?: string
  className?: string
}

/** A form's fields (a record being opened for editing, a dialog's form). */
export function SkeletonFields({
  count = 6,
  columns = 2,
  label,
  className = "",
}: SkeletonFieldsProps) {
  const grid =
    columns === 1
      ? ""
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3"
  return (
    <SkeletonStatus
      label={label}
      className={`grid grid-cols-1 gap-x-4 gap-y-4 ${grid} ${className}`.trim()}
    >
      {Array.from({ length: count }, (_, i) => (
        <FieldShape key={i} index={i} />
      ))}
    </SkeletonStatus>
  )
}

export interface SkeletonGridProps {
  rows?: number
  /** Column widths in %. */
  columns?: number[]
  /** The head band above the rows. */
  head?: boolean
  label?: string
  className?: string
}

/** A table drawn without <table> (where rows sit outside a table: a feed, an overlay). */
export function SkeletonGrid({
  rows = 6,
  columns = [26, 20, 32, 14],
  head = false,
  label,
  className = "",
}: SkeletonGridProps) {
  return (
    <SkeletonStatus label={label} className={className}>
      {head ? (
        <div className="h-10 border-b border-line bg-surface-muted" />
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex gap-6 border-b border-line-subtle px-4 py-3.5 last:border-0"
        >
          {columns.map((width, at) => (
            <Skeleton
              key={at}
              className="h-3"
              style={{
                width: `${Math.max(8, width - ((i * 7 + at * 3) % 9))}%`,
              }}
            />
          ))}
        </div>
      ))}
    </SkeletonStatus>
  )
}

export interface SkeletonCardsProps {
  count?: number
  /** The real grid's classes, so the cards sit where the records will. */
  gridClassName?: string
  label?: string
}

/** Record cards in a grid (the album views): a tile, a name and two lines, a footer. */
export function SkeletonCards({
  count = 6,
  gridClassName = "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
  label,
}: SkeletonCardsProps) {
  return (
    <SkeletonStatus label={label} className={gridClassName}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5"
        >
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton
                className="h-3"
                style={{ width: `${[64, 52, 72, 58][i % 4]}%` }}
              />
              <Skeleton
                className="h-2.5"
                style={{ width: `${[36, 44, 30, 40][i % 4]}%` }}
              />
            </div>
          </div>
          <Skeleton
            className="h-2.5"
            style={{ width: `${[80, 66, 74, 60][i % 4]}%` }}
          />
          <Skeleton
            className="h-2.5"
            style={{ width: `${[48, 56, 40, 52][i % 4]}%` }}
          />
        </div>
      ))}
    </SkeletonStatus>
  )
}

export type SkeletonPageKind = "list" | "detail" | "form" | "dashboard"

export interface SkeletonPageProps {
  kind?: SkeletonPageKind
  label?: string
}

/** A page's title row: the title, a subtitle, the actions at the right. */
function PageHead({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto min-w-0 space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-2.5 w-64 max-w-full" />
      </div>
      {Array.from({ length: actions }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-9 rounded-[var(--radius-control)] ${
            i ? "w-32" : "w-24"
          }`}
        />
      ))}
    </div>
  )
}

/** A card with a title band and its contents. */
function CardShape({
  children,
  title = "w-32",
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line-subtle px-5 py-3.5">
        <Skeleton className={`h-3 ${title}`} />
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/**
 * A whole page while its code loads (lazy routes): a list (title, filters, table), a record (title, tabs, cards), a
 * form (title, sections of fields) or the dashboard (figures, then panels).
 */
export function SkeletonPage({
  kind = "list",
  label = "Loading",
}: SkeletonPageProps) {
  return (
    <SkeletonStatus
      label={label}
      className="page-gutter flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-5"
    >
      {kind === "list" ? (
        <>
          <PageHead />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-72 max-w-full rounded-[var(--radius-control)]" />
            {[28, 24, 32].map((w) => (
              <Skeleton
                key={w}
                className="h-9 rounded-[var(--radius-control)]"
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
            <SkeletonGrid head rows={9} columns={[18, 24, 16, 20, 12]} />
          </div>
        </>
      ) : null}
      {kind === "detail" ? (
        <>
          <PageHead actions={3} />
          <div className="flex gap-2 border-b border-line pb-2">
            {[20, 24, 18, 22].map((w) => (
              <Skeleton
                key={w}
                className="h-7 rounded-md"
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <CardShape key={card} title={["w-28", "w-36", "w-24"][card]}>
                <div className="space-y-3">
                  {[55, 72, 48, 64].map((w) => (
                    <Skeleton
                      key={w}
                      className="h-2.5"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </CardShape>
            ))}
          </div>
        </>
      ) : null}
      {kind === "form" ? (
        <>
          <PageHead />
          {[6, 4].map((fields, section) => (
            <CardShape key={section} title={section ? "w-28" : "w-40"}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: fields }, (_, i) => (
                  <FieldShape key={i} index={i} />
                ))}
              </div>
            </CardShape>
          ))}
        </>
      ) : null}
      {kind === "dashboard" ? (
        <>
          <PageHead actions={1} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="space-y-2.5 rounded-xl border border-line bg-surface p-4"
              >
                <Skeleton
                  className="h-2.5"
                  style={{ width: `${[52, 44, 60, 48, 56, 40][i]}%` }}
                />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((card) => (
              <CardShape key={card} title={card ? "w-28" : "w-36"}>
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-center gap-3">
                      <Skeleton className="h-2.5 w-28 shrink-0" />
                      <Skeleton
                        className="h-5 flex-1 rounded-md"
                        style={{ maxWidth: `${[90, 70, 80, 55, 64][row]}%` }}
                      />
                    </div>
                  ))}
                </div>
              </CardShape>
            ))}
          </div>
        </>
      ) : null}
    </SkeletonStatus>
  )
}

/** One bar of the loading screen (.bsk, styled in index.html and in Spectrum ERP's). */
function BootBar({
  width,
  height = 12,
  className,
  style,
}: {
  width: string
  height?: number
  className?: string
  style?: CSSProperties
}) {
  const phase = useSkeletonPhase()
  return (
    <span
      className={className ? `bsk ${className}` : "bsk"}
      style={{ ...phase, width, height, ...style }}
    />
  )
}

export interface BootShellProps {
  label?: string
}

/**
 * The loading screen: the app's shape (sidebar, header, a page of cards and rows) in skeleton bars, while the
 * session is checked and the first route's code loads. The same markup and classes as index.html's loading screen
 * (styled there) and as Spectrum ERP's (its BootScreen), so the CRM paints the same way standalone and inside the
 * shell, and React taking over from index.html never jumps.
 */
export function BootShell({ label = "Loading" }: BootShellProps) {
  return (
    <div
      className="boot-shell boot-chrome"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="boot-side" aria-hidden="true">
        <div className="boot-side-logo">
          <BootBar width="120px" height={22} />
        </div>
        <div className="boot-side-nav">
          {[62, 48, 70, 54, 66, 44, 58].map((width) => (
            <div key={width} className="boot-side-item">
              <BootBar
                width="28px"
                height={28}
                style={{ flexShrink: 0, borderRadius: 6 }}
              />
              <BootBar width={`${width}%`} height={11} className="bsk-label" />
            </div>
          ))}
        </div>
      </div>
      <div className="boot-main">
        <div className="boot-head" aria-hidden="true">
          <span className="boot-head-logo">
            <BootBar width="120px" height={28} />
          </span>
          <span className="boot-head-search">
            <BootBar width="min(22rem, 40vw)" height={36} />
          </span>
          <span className="boot-head-actions">
            {[0, 1, 2].map((i) => (
              <BootBar key={i} width="32px" height={32} className="bsk-round" />
            ))}
            <BootBar width="120px" height={32} />
          </span>
        </div>
        <div className="boot-body" aria-hidden="true">
          <div className="boot-page">
            <div className="boot-strip">
              <BootBar width="64px" />
              <BootBar width="140px" />
            </div>
            <BootBar width="220px" height={20} />
            <div className="boot-cards">
              {[
                [40, 70],
                [52, 62],
                [46, 76],
                [34, 58],
              ].map(([first, last]) => (
                <div key={first} className="boot-card">
                  <BootBar
                    width="44px"
                    height={44}
                    style={{ flexShrink: 0, borderRadius: 12 }}
                  />
                  <span className="boot-lines">
                    <BootBar width={`${first}%`} />
                    <BootBar width="56px" height={24} />
                    <BootBar width={`${last}%`} height={10} />
                  </span>
                </div>
              ))}
            </div>
            <div className="boot-panel">
              <div className="boot-panel-head">
                <BootBar width="120px" height={14} />
                <BootBar width="64px" height={10} />
              </div>
              {[
                [28, 20, 36, 16],
                [24, 18, 30, 14],
                [30, 22, 34, 18],
                [26, 16, 38, 12],
                [28, 20, 32, 16],
                [22, 18, 36, 14],
              ].map((columns, row) => (
                <div key={row} className="boot-row">
                  {columns.map((width, at) => (
                    <BootBar key={at} width={`${width}%`} height={14} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The sign-in page's shape (the brand panel on wide screens, the form) while the CRM hands over to Spectrum ERP's
 * sign-in. Styled in index.html (.boot-login), shown without the app's sidebar and header.
 */
export function BootLogin({ label = "Loading" }: BootShellProps) {
  return (
    <div
      className="boot-shell boot-signin"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="boot-main">
        <div className="boot-body" aria-hidden="true">
          <div className="boot-login">
            <div className="boot-brand">
              <BootBar width="160px" height={40} />
              <span style={{ flex: 1 }} />
              <BootBar width="70%" height={28} />
              <BootBar width="55%" height={28} />
              <BootBar width="80%" />
              <BootBar width="64%" />
              <span style={{ flex: 1 }} />
            </div>
            <div className="boot-form">
              <BootBar width="150px" height={24} />
              <BootBar width="220px" />
              <span style={{ height: 12 }} />
              {[80, 72, 90].map((width) => (
                <span key={width} style={{ display: "contents" }}>
                  <BootBar width={`${width}px`} />
                  <BootBar width="100%" height={42} />
                  <span style={{ height: 4 }} />
                </span>
              ))}
              <span style={{ height: 6 }} />
              <BootBar width="100%" height={44} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
