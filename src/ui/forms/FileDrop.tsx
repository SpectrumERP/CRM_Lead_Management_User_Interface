import { useId, useRef } from 'react'

export interface FileDropProps {
  id?: string
  accept?: string
  fileName?: string
  disabled?: boolean
  invalid?: boolean
  buttonLabel?: string
  onFile: (file: File) => void
  onClear?: () => void
}

/** Hidden file input + dashed trigger. Pages pass `accept` and handle the File. */
export function FileDrop({
  id,
  accept,
  fileName,
  disabled,
  invalid,
  buttonLabel = 'Browse & Attach File',
  onFile,
  onClear,
}: FileDropProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <input
        id={inputId}
        ref={ref}
        type="file"
        className="sr-only"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
      {fileName ? (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-hover border border-line">
          <span className="text-xs font-medium flex-1 truncate text-ink">{fileName}</span>
          {onClear ? (
            <button type="button" className="text-xs font-semibold text-accent" onClick={onClear} disabled={disabled}>
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onClick={() => ref.current?.click()}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-surface-hover text-ink-soft border border-dashed ${
            invalid ? 'border-accent' : 'border-line'
          }`}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
