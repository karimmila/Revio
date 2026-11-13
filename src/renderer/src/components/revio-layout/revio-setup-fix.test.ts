import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  repos: [{ id: 'r', hookSettings: { scripts: { setup: 'pnpm install\nexit 3' } } }]
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/store/slices/worktree-helpers', () => ({
  findWorktreeById: () => ({ id: 'w', repoId: 'r', path: '/w' })
}))
vi.mock('./revio-setup-rerun', () => ({
  revioSetupTabs: () => [{ tabId: 't', localPtyIds: ['pty-1'] }]
}))
const launch = vi.hoisted(() =>
  vi.fn<(worktreeId: string, options: { prompt?: string }) => boolean>(() => true)
)
vi.mock('./launch-revio-chat', () => ({ launchRevioAgentChat: launch }))

const { fixSetupWithAgent, setupFixPrompt, setupLogText } = await import('./revio-setup-fix')

const getMainBufferSnapshot = vi.fn()
beforeEach(() => {
  launch.mockClear()
  getMainBufferSnapshot.mockReset()
  vi.stubGlobal('window', {
    api: { pty: { getMainBufferSnapshot }, hooks: { check: vi.fn() } }
  })
})

describe('setupLogText', () => {
  it('drops colors and carriage returns', () => {
    expect(setupLogText('\x1b[31merror\x1b[0m: boom\r\n\r\n\r\n\r\ndone\r')).toBe(
      'error: boom\n\ndone'
    )
  })

  it('keeps only the tail of a long log', () => {
    const text = setupLogText(`${'a'.repeat(30_000)}END`)
    expect(text.startsWith('…\n')).toBe(true)
    expect(text.endsWith('END')).toBe(true)
    expect(text.length).toBeLessThan(20_010)
  })
})

describe('setupFixPrompt', () => {
  it('names the script and quotes the logs', () => {
    const prompt = setupFixPrompt({ script: 'make setup', logs: 'exit 1' })
    expect(prompt).toContain('setup script failed')
    expect(prompt).toContain('```sh\nmake setup\n```')
    expect(prompt).toContain('Setup logs:\n```\nexit 1\n```')
  })

  it('says so when the logs are gone', () => {
    const prompt = setupFixPrompt({ script: null, logs: '' })
    expect(prompt).not.toContain('The setup script is')
    expect(prompt).toContain('Setup tab was closed')
  })
})

describe('fixSetupWithAgent', () => {
  it("sends the Setup tab's output and the script to a new chat", async () => {
    getMainBufferSnapshot.mockResolvedValue({ data: '\x1b[1mnpm ERR!\x1b[0m missing' })
    await fixSetupWithAgent('w')
    expect(getMainBufferSnapshot).toHaveBeenCalledWith('pty-1')
    const [worktreeId, options] = launch.mock.calls[0] ?? []
    expect(worktreeId).toBe('w')
    expect(options?.prompt).toContain('npm ERR! missing')
    expect(options?.prompt).toContain('pnpm install\nexit 3')
  })
})
