import { describe, expect, it } from 'vitest'
import { isImageDocument, sanitizePreviewUrl } from './documents'

describe('document image preview', () => {
  it('treats IMG type and image filenames as images', () => {
    expect(isImageDocument('IMG', 'teem_bg.png')).toBe(true)
    expect(isImageDocument('PDF', 'note.pdf')).toBe(false)
    expect(isImageDocument('FILE', 'photo.webp')).toBe(true)
  })

  it('only keeps data:image preview URLs', () => {
    expect(sanitizePreviewUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(sanitizePreviewUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizePreviewUrl('https://example.com/a.png')).toBeUndefined()
  })
})
