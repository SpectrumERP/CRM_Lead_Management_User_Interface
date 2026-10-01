import { describe, expect, it, vi } from 'vitest'
import { installNumberInputGuards } from './numberInputs'

/** Minimal stand-ins for the DOM pieces the guard uses (tests run without a browser). */
class FakeInput {
  type: string
  blur = vi.fn()
  constructor(type: string) {
    this.type = type
  }
}

function fakeDocument(active: unknown) {
  const listeners: Record<string, (e: unknown) => void> = {}
  return {
    activeElement: active,
    addEventListener: (name: string, fn: (e: unknown) => void) => { listeners[name] = fn },
    removeEventListener: vi.fn(),
    fire: (name: string, event: unknown) => listeners[name]?.(event),
  }
}

describe('number input guards', () => {
  it('blurs a focused number field on wheel and blocks arrow-key stepping', () => {
    vi.stubGlobal('HTMLInputElement', FakeInput)
    const input = new FakeInput('number')
    const doc = fakeDocument(input)
    installNumberInputGuards(doc as unknown as Document)

    doc.fire('wheel', { target: input })
    expect(input.blur).toHaveBeenCalled()

    const up = { target: input, key: 'ArrowUp', preventDefault: vi.fn() }
    doc.fire('keydown', up)
    expect(up.preventDefault).toHaveBeenCalled()

    const typing = { target: input, key: '5', preventDefault: vi.fn() }
    doc.fire('keydown', typing)
    expect(typing.preventDefault).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('leaves other inputs alone', () => {
    vi.stubGlobal('HTMLInputElement', FakeInput)
    const text = new FakeInput('text')
    const doc = fakeDocument(text)
    installNumberInputGuards(doc as unknown as Document)
    doc.fire('wheel', { target: text })
    const down = { target: text, key: 'ArrowDown', preventDefault: vi.fn() }
    doc.fire('keydown', down)
    expect(text.blur).not.toHaveBeenCalled()
    expect(down.preventDefault).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
