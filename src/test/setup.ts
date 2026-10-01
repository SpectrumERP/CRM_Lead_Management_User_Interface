/**
 * Tests never touch the network. The default `fetch` fails at once (like being offline), so code that
 * tries the Spectrum server first — e.g. login — falls back immediately instead of waiting on a real
 * host. Tests that need server responses stub `fetch` themselves; `vi.unstubAllGlobals()` returns
 * to this offline default, not to the real network.
 */
globalThis.fetch = (async () => {
  throw new TypeError('Network access is disabled in tests')
}) as typeof fetch
