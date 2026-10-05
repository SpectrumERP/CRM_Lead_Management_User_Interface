import { useState } from 'react'
import type { ToastType } from '../../components/Toast'
import { STAGNANT_DAYS_MAX, STAGNANT_DAYS_MIN, setStagnantDays, useStagnantDays } from '../../data/dashboardSettings'
import { Button, Card, TextField } from '../../ui'

interface Props {
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/** Dashboard rules the user can change (saved in this browser). */
export default function DashboardSettingsSection({ onToast }: Props) {
  const saved = useStagnantDays()
  const [draft, setDraft] = useState(String(saved))
  const value = Number(draft)
  const valid = Number.isInteger(value) && value >= STAGNANT_DAYS_MIN && value <= STAGNANT_DAYS_MAX
  const changed = valid && value !== saved

  return (
    <Card className="max-w-xl p-5">
      <h2 className="text-base font-bold text-ink">Dashboard</h2>
      <p className="mt-0.5 mb-4 text-sm text-ink-muted">Rules for the Requiring Attention sections.</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!changed) return
          setStagnantDays(value)
          onToast?.('success', 'Setting saved', `Stagnant after ${value} days.`)
        }}
      >
        <TextField
          label="Stagnant after (days)"
          type="number"
          min={STAGNANT_DAYS_MIN}
          max={STAGNANT_DAYS_MAX}
          step={1}
          value={draft}
          onValueChange={setDraft}
          error={draft && !valid ? `Enter a whole number from ${STAGNANT_DAYS_MIN} to ${STAGNANT_DAYS_MAX}.` : undefined}
          hint="A lead or opportunity in the same stage for more days than this is marked Stagnant. Saved in this browser."
          fieldClassName="w-64"
        />
        <Button type="submit" disabled={!changed}>
          Save
        </Button>
      </form>
    </Card>
  )
}
