/** Bulk import of business entities from an .xlsx file: pick → format check → upload → result. */
import { useEffect, useRef, useState } from 'react'
import { bulkImportBusinessEntities, type BulkImportResult } from '../../api/businessEntityImport'
import {
  checkImportSheets,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_SHEET_NAME,
  IMPORT_TEMPLATE_FILE,
  type ImportCheck,
} from '../../api/businessEntityImportSheet'
import { toApiError } from '../../api/errors'
import { getFileExtension } from '../../api/uploadFiles'
import { Card, Spinner } from '../../ui'
import { ICON, Icon, OutlineButton, SolidButton } from './ui'

interface Props {
  companyNo: number
  onClose: () => void
  /** Called once when the import added entities, so the list can reload. */
  onImported: () => void
}

type Phase = 'pick' | 'checking' | 'checked' | 'uploading' | 'done'

const templateUrl = `${import.meta.env.BASE_URL}templates/${IMPORT_TEMPLATE_FILE}`

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Reads the workbook (lazy chunk) and checks its layout. Throws a readable message when it is not a workbook. */
async function checkFile(file: File): Promise<ImportCheck> {
  if (getFileExtension(file.name) !== 'xlsx') throw new Error('Only .xlsx files can be imported. Save the file as an Excel Workbook (.xlsx).')
  if (file.size === 0) throw new Error('The file is empty.')
  if (file.size > IMPORT_MAX_FILE_BYTES) throw new Error(`The file is larger than ${IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB.`)
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  try {
    return checkImportSheets(await readXlsxFile(file))
  } catch {
    throw new Error('This file could not be read as an Excel workbook. It may be damaged or password protected.')
  }
}

export default function BulkImportDialog({ companyNo, onClose, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [problem, setProblem] = useState('')
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const busy = phase === 'checking' || phase === 'uploading'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => () => abort.current?.abort(), [])

  async function pick(chosen: File | undefined) {
    if (!chosen) return
    setFile(chosen)
    setCheck(null)
    setProblem('')
    setPhase('checking')
    try {
      setCheck(await checkFile(chosen))
      setPhase('checked')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The file could not be checked.')
      setPhase('pick')
    }
  }

  async function upload() {
    if (!file) return
    abort.current = new AbortController()
    setProblem('')
    setPhase('uploading')
    try {
      const outcome = await bulkImportBusinessEntities(file, companyNo, abort.current.signal)
      setResult(outcome)
      setPhase('done')
      if (outcome.importedCount === null ? outcome.success : outcome.importedCount > 0) onImported()
    } catch (error) {
      setProblem(toApiError(error).message)
      setPhase('checked')
    }
  }

  function reset() {
    setPhase('pick')
    setFile(null)
    setCheck(null)
    setResult(null)
    setProblem('')
    if (input.current) input.current.value = ''
  }

  const blocking = (check?.issues.length ?? 0) > 0
  const subtitle: Record<Phase, string> = {
    pick: 'Upload the filled template',
    checking: 'Checking the file…',
    checked: blocking ? 'Fix the file and choose it again' : 'The file is in the right format',
    uploading: 'Importing…',
    done: 'Import finished',
  }

  return (
    <div
      className="ui-scrim fixed inset-0 z-[80] flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        className="relative flex max-h-[calc(100vh-3rem)] w-[40rem] max-w-full flex-col overflow-hidden shadow-overlay animate-[scaleIn_0.16s_ease]"
      >
        <div className="flex items-center gap-3 border-b border-line bg-surface-muted px-5 py-3.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon d={ICON.layers} size={17} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="bulk-import-title" className="text-sm font-semibold tracking-tight text-ink">Import Business Entities</h2>
            <p className="text-[11px] font-medium text-ink-faint">{subtitle[phase]}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-faint hover:bg-surface-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon d={ICON.x} size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === 'done' && result ? (
            <ResultView result={result} />
          ) : (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (!busy) void pick(e.dataTransfer.files[0])
                }}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors ${
                  dragging ? 'border-primary bg-primary-soft' : 'border-line bg-surface-muted'
                }`}
              >
                <Icon d={ICON.file} size={26} className="text-ink-faint" strokeWidth={1.5} />
                {file ? (
                  <p className="text-sm font-semibold text-ink">{file.name} <span className="font-normal text-ink-faint">· {(file.size / 1024).toFixed(0)} KB</span></p>
                ) : (
                  <p className="text-sm font-medium text-ink">Drag and drop your .xlsx file here</p>
                )}
                <input
                  ref={input}
                  type="file"
                  hidden
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => void pick(e.target.files?.[0])}
                />
                <OutlineButton className="h-8" disabled={busy} onClick={() => input.current?.click()}>
                  {file ? 'Choose another file' : 'Browse file'}
                </OutlineButton>
                <p className="text-[11px] text-ink-faint">
                  .xlsx · sheet “{IMPORT_SHEET_NAME}” · up to {IMPORT_MAX_ROWS} entities · max {IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB
                </p>
              </div>

              <p className="mt-2.5 text-xs text-ink-soft">
                Use the template so the columns match.{' '}
                <a href={templateUrl} download={IMPORT_TEMPLATE_FILE} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <Icon d={ICON.download} size={12} /> Download template
                </a>
              </p>

              {phase === 'checking' || phase === 'uploading' ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft" role="status">
                  <Spinner /> {phase === 'checking' ? 'Checking the file format…' : 'Importing business entities. Keep this window open.'}
                </p>
              ) : null}

              {problem ? <Alert tone="error">{problem}</Alert> : null}
              {check ? <CheckView check={check} /> : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3">
          {phase === 'done' ? (
            <>
              <OutlineButton className="h-9" onClick={reset}>Import another file</OutlineButton>
              <SolidButton className="h-9 px-4" onClick={onClose}>Done</SolidButton>
            </>
          ) : (
            <>
              <OutlineButton className="h-9" disabled={busy} onClick={onClose}>Cancel</OutlineButton>
              <SolidButton className="h-9 px-4" disabled={phase !== 'checked' || blocking} onClick={() => void upload()}>
                <Icon d={ICON.save} size={14} />
                {phase === 'uploading' ? 'Importing…' : check && !blocking ? `Import ${check.rowCount} ${check.rowCount === 1 ? 'entity' : 'entities'}` : 'Import'}
              </SolidButton>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

function Alert({ tone, children }: { tone: 'error' | 'success' | 'warn'; children: React.ReactNode }) {
  const style = { error: 'border-accent/30 bg-accent-soft text-accent', success: 'border-primary/30 bg-primary-soft text-primary', warn: 'border-line bg-surface-muted text-ink' }[tone]
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${style}`}>{children}</div>
}

function CheckView({ check }: { check: ImportCheck }) {
  if (check.issues.length === 0) {
    return <Alert tone="success"><span className="font-semibold">Format OK.</span> {check.rowCount} {check.rowCount === 1 ? 'entity' : 'entities'} found and ready to import.</Alert>
  }
  const total = check.issues.length + check.hiddenIssues
  return (
    <Alert tone="error">
      <p className="font-semibold">{total} {total === 1 ? 'problem' : 'problems'} found. Nothing was uploaded.</p>
      <ul className="mt-1.5 max-h-52 list-disc space-y-0.5 overflow-y-auto pl-5 text-[13px]">
        {check.issues.map((issue, i) => (
          <li key={i}>
            {issue.row ? <span className="font-semibold">Row {issue.row}{issue.column ? ` · ${issue.column}` : ''}: </span> : null}
            {issue.column && issue.row ? `${issue.message}` : issue.message}
          </li>
        ))}
      </ul>
      {check.hiddenIssues ? <p className="mt-1.5 text-xs">…and {check.hiddenIssues} more.</p> : null}
    </Alert>
  )
}

function ResultView({ result }: { result: BulkImportResult }) {
  const { importedCount, failedCount, totalRows, failures } = result
  const counted = importedCount !== null || failedCount !== null
  const partial = !result.success && Boolean(importedCount)
  return (
    <div>
      <Alert tone={result.success ? 'success' : 'error'}>
        <p className="font-semibold">
          {result.success
            ? 'Import completed.'
            : partial
              ? `${importedCount} imported, ${failedCount ?? 'some'} failed.`
              : 'Nothing was imported.'}
        </p>
        {result.message ? <p className="mt-0.5">{result.message}</p> : null}
        {partial ? <p className="mt-0.5 text-[13px]">The imported entities are already saved. Fix only the failed rows below and import them again, so nothing is added twice.</p> : null}
      </Alert>
      {counted ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Rows', totalRows, 'text-ink'],
            ['Imported', importedCount, 'text-primary'],
            ['Failed', failedCount, failedCount ? 'text-accent' : 'text-ink'],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
              <dd className={`text-lg font-semibold tabular-nums ${tone}`}>{value ?? '–'}</dd>
              <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {failures.length ? (
        <div className="mt-3">
          <h3 className="mb-1.5 text-xs font-semibold text-ink">Failed rows ({failures.length})</h3>
          <div className="max-h-56 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-muted text-ink-faint">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Row</th>
                  <th className="px-2.5 py-1.5 font-semibold">Import Ref</th>
                  <th className="px-2.5 py-1.5 font-semibold">Entity</th>
                  <th className="px-2.5 py-1.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.row} className="border-t border-line align-top">
                    <td className="px-2.5 py-1.5 tabular-nums text-ink-soft">{f.row}</td>
                    <td className="px-2.5 py-1.5 text-ink-soft">{f.importRef || '–'}</td>
                    <td className="px-2.5 py-1.5 text-ink">{f.name || '–'}</td>
                    <td className="px-2.5 py-1.5 text-accent">{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : result.errors.length ? (
        <ul className="mt-3 max-h-44 list-disc space-y-0.5 overflow-y-auto pl-5 text-[13px] text-ink-soft">
          {result.errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
      {result.file ? (
        <OutlineButton className="mt-3 h-9" onClick={() => saveBlob(result.file!.blob, result.file!.fileName)}>
          <Icon d={ICON.download} size={14} /> Download result file
        </OutlineButton>
      ) : null}
    </div>
  )
}
