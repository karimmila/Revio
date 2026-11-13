import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readCursorAuthSession } from './cursor-auth'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { fetchCodexRateLimits } from './codex-fetcher'
import { readGrokAuthSession } from './grok-auth'
import { fetchKimiRateLimits } from './kimi-fetcher'
import { resolveOpenCodeGoApiKey } from './opencode-go-api-key-source'
import { isUsageMeterEnabled } from './usage-meter-gate'
import { installUsageMeterOptIn, type UsageMeterOptInDeps } from './usage-meter-opt-in'

type Listener = Parameters<UsageMeterOptInDeps['statusSource']['subscribeEnrichedStatus']>[0]

describe('usage meter opt-in', () => {
  let dir: string
  let filePath: string
  let emit: Listener
  let uninstall: () => void
  const onProviderEnabled = vi.fn()

  function install(accounts = { claude: 0, codex: 0 }): void {
    uninstall = installUsageMeterOptIn({
      filePath,
      statusSource: {
        subscribeEnrichedStatus: (listener) => {
          emit = listener
          return () => {}
        }
      },
      managedAccountCounts: () => accounts,
      onProviderEnabled
    })
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'usage-meter-opt-in-'))
    filePath = join(dir, 'nested', 'usage-meter-providers.json')
    onProviderEnabled.mockClear()
  })

  afterEach(() => {
    uninstall()
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads nothing on a new profile: no request and no credential lookup', async () => {
    install()
    for (const provider of ['claude', 'codex', 'cursor', 'grok', 'kimi', 'zcode'] as const) {
      expect(isUsageMeterEnabled(provider)).toBe(false)
    }
    expect(isUsageMeterEnabled('antigravity')).toBe(false)
    expect(isUsageMeterEnabled('opencode-go')).toBe(false)
    // Each of these returns before it touches the Keychain, a credential file or the network.
    expect(await readCursorAuthSession()).toEqual({ status: 'missing' })
    expect(readGrokAuthSession()).toEqual({ status: 'missing' })
    expect(await fetchClaudeRateLimits()).toMatchObject({
      provider: 'claude',
      status: 'unavailable'
    })
    expect(await fetchCodexRateLimits()).toMatchObject({ provider: 'codex', status: 'unavailable' })
    expect(await fetchKimiRateLimits()).toMatchObject({ provider: 'kimi', status: 'unavailable' })
    expect(await resolveOpenCodeGoApiKey({ environment: { OPENCODE_API_KEY: 'ambient' } })).toEqual(
      {
        status: 'missing'
      }
    )
  })

  it('keeps a key the person saved in Settings working while the meter is gated', async () => {
    install()
    expect(await resolveOpenCodeGoApiKey({ settingsOverride: 'saved-key' })).toEqual({
      status: 'found',
      key: 'saved-key',
      tier: 'settings'
    })
    expect(isUsageMeterEnabled('minimax')).toBe(true)
    expect(isUsageMeterEnabled('gemini')).toBe(true)
  })

  it('turns on only the provider whose agent ran, and remembers it', () => {
    install()
    emit({ payload: { agentType: 'cursor' } })
    expect(isUsageMeterEnabled('cursor')).toBe(true)
    expect(isUsageMeterEnabled('claude')).toBe(false)
    expect(onProviderEnabled).toHaveBeenCalledExactlyOnceWith('cursor')
    emit({ payload: { agentType: 'cursor' } })
    expect(onProviderEnabled).toHaveBeenCalledTimes(1)
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(['cursor'])

    uninstall()
    install()
    expect(isUsageMeterEnabled('cursor')).toBe(true)
    expect(onProviderEnabled).toHaveBeenCalledTimes(1)
  })

  it('ignores replayed and restored rows, and agents without a meter', () => {
    install()
    emit({ isReplay: true, payload: { agentType: 'claude' } })
    emit({ restoredUnconfirmed: true, payload: { agentType: 'codex' } })
    emit({ payload: { agentType: 'aider' } })
    emit({ payload: {} })
    expect(isUsageMeterEnabled('claude')).toBe(false)
    expect(isUsageMeterEnabled('codex')).toBe(false)
    expect(onProviderEnabled).not.toHaveBeenCalled()
  })

  it('counts an account added in Settings as opting in', () => {
    install({ claude: 1, codex: 0 })
    expect(isUsageMeterEnabled('claude')).toBe(true)
    expect(isUsageMeterEnabled('codex')).toBe(false)
  })

  it('treats a damaged list as a new profile', () => {
    writeFileSync(join(dir, 'broken.json'), '{not json')
    filePath = join(dir, 'broken.json')
    install()
    expect(isUsageMeterEnabled('claude')).toBe(false)
  })

  it('leaves every meter on when nothing installed the gate', () => {
    install()
    uninstall()
    expect(isUsageMeterEnabled('cursor')).toBe(true)
    uninstall = () => {}
  })
})
