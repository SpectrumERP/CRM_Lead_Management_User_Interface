import { useState } from 'react'
import type { ToastType } from '../../components/Toast'
import { STAGNANT_DAYS_MAX, STAGNANT_DAYS_MIN, setStagnantDays, useStagnantDays } from '../../data/dashboardSettings'
import { Button } from '../../ui'

interface Props {
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/** Common choices, one click away. */
const PRESET_DAYS = [7, 15, 30, 60]

/** Dashboard rules the user can change (saved in this browser), laid out like the other Settings sections. */
export default function DashboardSettingsSection({ onToast }: Props) {
  const saved = useStagnantDays()
  const [draft, setDraft] = useState(String(saved))
  const value = Number(draft)
  const valid = Number.isInteger(value) && value >= STAGNANT_DAYS_MIN && value <= STAGNANT_DAYS_MAX
  const changed = valid && value !== saved
  const error = draft && !valid ? `Enter a whole number from ${STAGNANT_DAYS_MIN} to ${STAGNANT_DAYS_MAX}.` : ''

  // − / + step from the typed value (or the saved one while the field is not a number), within the limits.
  const step = (by: number) => {
    const from = Number.isFinite(value) && draft !== '' ? Math.round(value) : saved
    setDraft(String(Math.min(STAGNANT_DAYS_MAX, Math.max(STAGNANT_DAYS_MIN, from + by))))
  }

  return (
    // Full width, aligned with the page header and the other Settings sections.
    <div className="w-full">
      {/* Title and description are in the page header (Settings). */}
      <form
        className="overflow-hidden rounded-xl border border-line bg-surface"
        onSubmit={(e) => {
          e.preventDefault()
          if (!changed) return
          setStagnantDays(value)
          onToast?.('success', 'Setting saved', `Stagnant after ${value} days.`)
        }}
      >
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div className="min-w-0">
              <label htmlFor="stagnant-days" className="text-sm font-semibold text-ink">
                Stagnant after
              </label>
              <p id="stagnant-days-help" className="mt-0.5 max-w-md text-xs leading-relaxed text-ink-muted">
                A lead or opportunity that stays in the same stage for more days than this is marked{' '}
                <span className="font-semibold text-ink-soft">Stagnant</span> on the dashboard.
              </p>
            </div>
          </div>

          <div className="shrink-0 md:text-right">
            <div className="inline-flex items-center gap-2">
              <div
                className={`inline-flex h-9 items-stretch overflow-hidden rounded-lg border bg-surface ${error ? 'border-[#c41e1e]' : 'border-line-strong focus-within:border-primary'}`}
              >
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={valid && value <= STAGNANT_DAYS_MIN}
                  aria-label="One day less"
                  className="grid w-9 place-items-center text-ink-soft transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <input
                  id="stagnant-days"
                  type="number"
                  inputMode="numeric"
                  min={STAGNANT_DAYS_MIN}
                  max={STAGNANT_DAYS_MAX}
                  step={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-describedby="stagnant-days-help"
                  aria-invalid={Boolean(error)}
                  // Inline: the app's input styles would otherwise right-align numbers.
                  style={{ textAlign: 'center' }}
                  className="w-16 border-x border-line bg-transparent text-center text-sm font-bold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={valid && value >= STAGNANT_DAYS_MAX}
                  aria-label="One day more"
                  className="grid w-9 place-items-center text-ink-soft transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
              <span className="text-sm font-semibold text-ink-soft">days</span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5 md:justify-end" role="group" aria-label="Common values">
              {PRESET_DAYS.map((days) => {
                const active = valid && value === days
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDraft(String(days))}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-soft'
                    }`}
                  >
                    {days} days
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="-mt-2 px-5 pb-4 text-xs font-semibold text-[#c41e1e]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted px-5 py-3">
          <p className="text-xs text-ink-muted">
            Saved in this browser · Current: <span className="font-semibold text-ink-soft">{saved} days</span>
          </p>
          <div className="flex items-center gap-2">
            {draft !== String(saved) ? (
              <Button type="button" variant="secondary" onClick={() => setDraft(String(saved))}>
                Reset
              </Button>
            ) : null}
            <Button type="submit" disabled={!changed}>
              Save
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
