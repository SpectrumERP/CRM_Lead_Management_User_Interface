import { useSpectrumCompany } from '../auth/useSpectrumCompany'

/**
 * Lead / opportunity screens use Spectrum server data only (no sample data). Shown when the user is
 * signed in without a Spectrum account, so empty lists are explained.
 */
export default function SpectrumRequiredNotice({ what }: { what: string }) {
  const company = useSpectrumCompany()
  if (!company.ready || company.enabled) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-xs text-ink" role="status">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="mt-0.5 shrink-0 text-warning" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p>
        <span className="font-bold">Spectrum account required.</span> {what} come from the Spectrum server — sign in with
        your Spectrum login ID to see and edit them.
      </p>
    </div>
  )
}
