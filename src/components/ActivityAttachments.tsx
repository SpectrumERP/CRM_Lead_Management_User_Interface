import { useEffect, useState } from 'react'
import { loadActivityAttachments } from '../api/activityAttachments'
import { openAttachment, type Attachment } from '../api/attachments'
import { toApiError } from '../api/errors'
import { useOptionalToast } from '../contexts/ToastContext'
import type { Activity } from '../data/activities'

const CLIP = (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
)

/**
 * A record's files listed from the document store (`load`, re-run when the record object changes), merged
 * with the ones it already carries (mock / load-data / just saved). A failed list leaves the carried ones.
 */
export function useStoreFiles<T extends { attachments?: readonly Attachment[] }>(
  record: T,
  load: (record: T) => Promise<Attachment[]>,
): Attachment[] {
  const [stored, setStored] = useState<Attachment[]>([])
  useEffect(() => {
    let cancelled = false
    load(record)
      .then((files) => { if (!cancelled) setStored(files) })
      .catch(() => { if (!cancelled) setStored([]) })
    return () => { cancelled = true }
  }, [record, load])
  const own = record.attachments ?? []
  return [...own, ...stored.filter((file) => !own.some((o) => o.id === file.id))]
}

/**
 * Files as chips; a click opens (or downloads) the file from the document store. With no files,
 * `fallbackName` (a name without store numbers, e.g. older records) is shown, not openable.
 */
export function AttachmentChips({ files, fallbackName, className = '' }: { files: readonly Attachment[]; fallbackName?: string; className?: string }) {
  const { addToast } = useOptionalToast()
  if (!files.length) {
    if (!fallbackName) return null
    return (
      <div className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft px-2.5 py-1.5 text-[11px] font-semibold text-primary ${className}`.trim()}>
        {CLIP}
        <span className="truncate">{fallbackName}</span>
      </div>
    )
  }
  return (
    <ul className={`m-0 flex list-none flex-wrap gap-1.5 p-0 ${className}`.trim()} aria-label="Attachments">
      {files.map((file) => (
        <li key={file.id} className="max-w-full">
          <button
            type="button"
            title={`Open ${file.name}`}
            onClick={() => {
              openAttachment(file).catch((error: unknown) => addToast('error', 'Could not open the file', toApiError(error).message))
            }}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {CLIP}
            <span className="truncate">{file.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

type ActivityFiles = Pick<Activity, 'id' | 'serverDetailNo' | 'attachments' | 'hasAttachment' | 'attachmentName'>

/** An activity's files: saved activities list theirs from the store (see useStoreFiles). */
export default function ActivityAttachments({ activity, className = '' }: { activity: ActivityFiles; className?: string }) {
  const files = useStoreFiles(activity, loadActivityAttachments)
  return <AttachmentChips files={files} fallbackName={activity.hasAttachment ? activity.attachmentName : undefined} className={className} />
}
