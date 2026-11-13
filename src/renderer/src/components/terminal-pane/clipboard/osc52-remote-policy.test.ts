import { describe, expect, it, vi } from 'vitest'
import {
  decideRemoteOsc52Write,
  REMOTE_OSC52_MAX_TEXT_BYTES,
  REMOTE_OSC52_TYPED_WITHIN_MS,
  resolveOsc52PaneSource,
  sanitizeRemoteOsc52Text
} from './osc52-remote-policy'
import { writeOsc52ForOrigin } from './osc52-remote-write'
import { handleOsc52ClipboardRequest } from '../../../../../shared/osc52-clipboard'

describe('resolveOsc52PaneSource', () => {
  it('keeps a Mac pane local, agent or not', () => {
    expect(resolveOsc52PaneSource({ remote: false, remoteDockStream: false, agent: true })).toBe(
      'local'
    )
  })

  it('tells a remote shell from a remote agent', () => {
    expect(resolveOsc52PaneSource({ remote: true, remoteDockStream: false, agent: false })).toBe(
      'remote-shell'
    )
    expect(resolveOsc52PaneSource({ remote: true, remoteDockStream: false, agent: true })).toBe(
      'remote-agent'
    )
  })

  it('treats a remote workspace dock tab as a log stream', () => {
    expect(resolveOsc52PaneSource({ remote: true, remoteDockStream: true, agent: false })).toBe(
      'remote-stream'
    )
  })
})

describe('decideRemoteOsc52Write', () => {
  it('allows only an interactive remote shell', () => {
    expect(decideRemoteOsc52Write('remote-shell', 'hi', 100)).toBe('allow')
    expect(decideRemoteOsc52Write('remote-agent', 'hi', 100)).toBe('refuse-source')
    expect(decideRemoteOsc52Write('remote-stream', 'hi', 100)).toBe('refuse-source')
  })

  it('caps the copy at 100 KB of UTF-8', () => {
    expect(
      decideRemoteOsc52Write('remote-shell', 'a'.repeat(REMOTE_OSC52_MAX_TEXT_BYTES), 100)
    ).toBe('allow')
    expect(
      decideRemoteOsc52Write('remote-shell', 'a'.repeat(REMOTE_OSC52_MAX_TEXT_BYTES + 1), 100)
    ).toBe('refuse-size')
    // Multi-byte text counts its bytes, not its characters.
    expect(
      decideRemoteOsc52Write('remote-shell', 'é'.repeat(REMOTE_OSC52_MAX_TEXT_BYTES / 2 + 1), 100)
    ).toBe('refuse-size')
  })
})

describe('remote copies need a recent keypress', () => {
  it('refuses a shell copy nobody typed for', () => {
    expect(decideRemoteOsc52Write('remote-shell', 'hi', REMOTE_OSC52_TYPED_WITHIN_MS)).toBe('allow')
    expect(decideRemoteOsc52Write('remote-shell', 'hi', REMOTE_OSC52_TYPED_WITHIN_MS + 1)).toBe(
      'refuse-idle'
    )
    expect(decideRemoteOsc52Write('remote-shell', 'hi', Number.POSITIVE_INFINITY)).toBe(
      'refuse-idle'
    )
  })
})

describe('sanitizeRemoteOsc52Text', () => {
  it('keeps newlines and tabs and drops other control characters', () => {
    expect(sanitizeRemoteOsc52Text('a\tb\r\nc\u001b[31md\u0007\u009be\u007f')).toBe('a\tb\nc[31mde')
  })
})

describe('writeOsc52ForOrigin', () => {
  const notices = () => ({ copied: vi.fn(), refused: vi.fn() })

  it('passes a local write through without a notice', async () => {
    const write = vi.fn(async () => {})
    const n = notices()
    await writeOsc52ForOrigin(
      'x',
      { source: 'local', cloud: false, sinceTypedMs: Infinity },
      write,
      n
    )
    expect(write).toHaveBeenCalledWith('x')
    expect(n.copied).not.toHaveBeenCalled()
  })

  it('writes the cleaned text for a remote shell', async () => {
    const write = vi.fn(async () => {})
    await writeOsc52ForOrigin(
      'x\u001b]0;evil\u0007y',
      { source: 'remote-shell', cloud: true, sinceTypedMs: 100 },
      write,
      notices()
    )
    expect(write).toHaveBeenCalledWith('x]0;evily')
  })

  it('announces a remote shell copy after it lands', async () => {
    const write = vi.fn(async () => {})
    const n = notices()
    await writeOsc52ForOrigin(
      'x',
      { source: 'remote-shell', cloud: true, sinceTypedMs: 100 },
      write,
      n
    )
    expect(write).toHaveBeenCalledWith('x')
    expect(n.copied).toHaveBeenCalledWith('x', true)
  })

  it('does not announce a copy the clipboard refused', async () => {
    const n = notices()
    await expect(
      writeOsc52ForOrigin(
        'x',
        { source: 'remote-shell', cloud: true, sinceTypedMs: 100 },
        async () => {
          throw new Error('no')
        },
        n
      )
    ).rejects.toThrow()
    expect(n.copied).not.toHaveBeenCalled()
  })

  it('never writes for an agent or a log stream', async () => {
    for (const source of ['remote-agent', 'remote-stream'] as const) {
      const write = vi.fn(async () => {})
      const n = notices()
      await writeOsc52ForOrigin('x', { source, cloud: true, sinceTypedMs: 100 }, write, n)
      expect(write).not.toHaveBeenCalled()
      expect(n.refused).toHaveBeenCalledWith('refuse-source', true)
    }
  })

  it('never writes an oversized remote copy', async () => {
    const write = vi.fn(async () => {})
    const n = notices()
    await writeOsc52ForOrigin(
      'a'.repeat(REMOTE_OSC52_MAX_TEXT_BYTES + 1),
      { source: 'remote-shell', cloud: false, sinceTypedMs: 100 },
      write,
      n
    )
    expect(write).not.toHaveBeenCalled()
    expect(n.refused).toHaveBeenCalledWith('refuse-size', false)
  })
})

describe('OSC 52 read requests', () => {
  it('are refused even with writes allowed', () => {
    const write = vi.fn(async () => {})
    expect(
      handleOsc52ClipboardRequest('c;?', { allowClipboardWrite: true, writeClipboardText: write })
    ).toBe(true)
    expect(write).not.toHaveBeenCalled()
  })
})
