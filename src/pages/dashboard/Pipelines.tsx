import { formatMoneyTotals } from '../../data/leads'
import type { LeadPipelineRow, OpportunityPipelineRow } from '../../data/dashboard'
import { SectionEmpty } from './parts'

/** Server stage colour; theme primary when the master has none. */
const FALLBACK_COLOR = 'var(--color-primary)'

function StageDot({ color }: { color?: string }) {
  return <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ background: color ?? FALLBACK_COLOR }} aria-hidden="true" />
}

function Bar({ count, max, color }: { count: number; max: number; color: string }) {
  const width = max > 0 && count > 0 ? Math.max((count / max) * 100, 6) : 0
  return (
    <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-surface-hover">
      <div className="h-full rounded-md transition-[width] duration-500 ease-out" style={{ width: `${width}%`, background: color }} />
    </div>
  )
}

export function LeadPipelineTable({ rows, onStage }: { rows: LeadPipelineRow[]; onStage: (stage: string) => void }) {
  if (rows.length === 0) return <SectionEmpty title="No lead stages configured" />
  const max = Math.max(...rows.map((r) => r.count))
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className="table-scroll">
      <table className="crm-table crm-table-fit" aria-label="Lead pipeline">
        <thead>
          <tr>
            <th scope="col">Lead Stage</th>
            <th scope="col" className="text-right">No of Leads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stage}>
              <td>
                <StageDot color={r.color} />
                <button
                  type="button"
                  onClick={() => onStage(r.stage)}
                  aria-label={`${r.stage}: ${r.count} open leads — open list`}
                  className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {r.stage}
                </button>
              </td>
              <td className="w-1/2">
                <span className="flex items-center gap-2">
                  <Bar count={r.count} max={max} color={r.color ?? FALLBACK_COLOR} />
                  <span className={`w-8 shrink-0 text-right tabular-nums ${r.count ? 'font-bold' : 'text-ink-faint'}`}>{r.count}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="font-bold">Total</td>
            <td className="text-right font-bold tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function OpportunityPipelineTable({ rows, onStage }: { rows: OpportunityPipelineRow[]; onStage: (stage: string) => void }) {
  if (rows.length === 0) return <SectionEmpty title="No opportunity stages configured" />
  const totalCount = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className="table-scroll">
      <table className="crm-table crm-table-fit" aria-label="Opportunity pipeline">
        <thead>
          <tr>
            <th scope="col">Opportunity Stage</th>
            <th scope="col" className="text-right">No of Opportunity</th>
            <th scope="col" className="text-right">Opportunity Value</th>
            <th scope="col" className="text-right">Weighted Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stage}>
              <td>
                <StageDot color={r.color} />
                <button
                  type="button"
                  onClick={() => onStage(r.stage)}
                  className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {r.stage}
                </button>
                <span className="ml-1.5 text-[11px] text-ink-muted">({r.weight}%)</span>
              </td>
              <td className={`text-right tabular-nums ${r.count ? 'font-bold' : 'text-ink-faint'}`}>{r.count}</td>
              <td className="text-right tabular-nums">{r.count ? formatMoneyTotals(r.values) : '—'}</td>
              <td className="text-right tabular-nums">{r.count ? formatMoneyTotals(r.weighted) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="font-bold">Total</td>
            <td className="text-right font-bold tabular-nums">{totalCount}</td>
            <td className="text-right font-bold tabular-nums">{formatMoneyTotals(rows.flatMap((r) => r.values))}</td>
            <td className="text-right font-bold tabular-nums">{formatMoneyTotals(rows.flatMap((r) => r.weighted))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
