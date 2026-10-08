/** CSV export without a spreadsheet library: RFC 4180 quoting, UTF-8 with BOM so Excel reads accents. */

/** Cells that start like a formula are prefixed so spreadsheets show them as text (CSV injection). */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Download `rows` as `filename` (a `.csv` name). */
export function downloadCsv(filename: string, rows: readonly (readonly (string | number | null | undefined)[])[]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
