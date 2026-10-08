import type { ReactNode } from 'react'
import { formatMoneyTotals } from '../../data/leads'
import type { MonthSales } from '../../data/dashboard'

const ROWS: Array<{ label: string; cell: (m: MonthSales) => ReactNode; tone?: string }> = [
  { label: 'No of Opportunity Created', cell: (m) => m.created },
  { label: 'No of Opportunity Lost', cell: (m) => m.lost, tone: 'text-accent' },
  { label: 'Lost Opportunity Value', cell: (m) => (m.lostValue.length ? formatMoneyTotals(m.lostValue) : ''), tone: 'text-accent' },
  { label: 'No of Opportunity Won', cell: (m) => m.won, tone: 'text-success' },
  { label: 'Total Order Value', cell: (m) => (m.wonValue.length ? formatMoneyTotals(m.wonValue) : ''), tone: 'text-success' },
]

/** Metrics down the side, months across (oldest → current). */
export function LastSixMonthsTable({ months }: { months: MonthSales[] }) {
  return (
    <div className="table-scroll">
      <table className="crm-table" aria-label="Last 6 months sales">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Metric</span>
            </th>
            {months.map((m, i) => (
              <th key={m.key} scope="col" className="text-right">
                {m.label}
                {i === months.length - 1 ? <span className="ml-1 font-normal text-ink-muted">(current)</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="font-semibold" style={{ position: 'static' }}>
                {row.label}
              </th>
              {months.map((m) => (
                <td key={m.key} className={`text-right tabular-nums ${row.tone ?? ''}`}>
                  {row.cell(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
