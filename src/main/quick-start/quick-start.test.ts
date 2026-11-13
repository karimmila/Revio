import { describe, expect, it, vi } from 'vitest'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))
vi.mock('../git/command-runner/gh-exec-file', () => ({ ghExecFileAsync: vi.fn() }))
vi.mock('@orca/process-host', () => ({ runProcess: vi.fn() }))

import { applyQuickStart, registerQuickStartHandlers, type QuickStartRunner } from './quick-start'

function fakeRunner(): QuickStartRunner & { calls: string[][]; files: Map<string, string> } {
  const calls: string[][] = []
  const files = new Map<string, string>()
  return {
    calls,
    files,
    run: vi.fn(async (command: string, args: string[]) => {
      calls.push([command, ...args])
      return ''
    }),
    gh: vi.fn(async (args: string[]) => {
      calls.push(['gh', ...args])
      return 'https://github.com/me/demo\n'
    }),
    write: vi.fn(async (path: string, text: string) => {
      files.set(path, text)
    }),
    exists: () => false
  }
}

describe('applyQuickStart (gh and npx mocked; never run live)', () => {
  it('writes the Empty template, commits, then creates a private repo and pushes', async () => {
    const runner = fakeRunner()
    const result = await applyQuickStart(
      { repoPath: '/p/demo', name: 'demo', template: 'empty', publishToGithub: true },
      runner
    )
    expect(result).toEqual({ ok: true, githubUrl: 'https://github.com/me/demo' })
    expect(runner.files.get('/p/demo/README.md')).toBe('# demo\n')
    expect(runner.calls).toEqual([
      ['git', 'add', '-A'],
      ['git', 'commit', '-m', 'Initial commit'],
      [
        'gh',
        'repo',
        'create',
        'demo',
        '--private',
        '--source',
        '/p/demo',
        '--remote',
        'origin',
        '--push'
      ]
    ])
  })

  it('scaffolds Next.js without installing and skips GitHub when not asked', async () => {
    const runner = fakeRunner()
    await applyQuickStart(
      { repoPath: '/p/web', name: 'web', template: 'nextjs', publishToGithub: false },
      runner
    )
    expect(runner.calls[0]).toContain('create-next-app@latest')
    expect(runner.calls[0]).toContain('--skip-install')
    expect(runner.calls.some((call) => call[0] === 'gh')).toBe(false)
  })

  it('reports a failing step', async () => {
    const runner = fakeRunner()
    runner.gh = vi.fn(async () => {
      throw new Error('gh: not logged in')
    })
    expect(
      await applyQuickStart(
        { repoPath: '/p/x', name: 'x', template: 'none', publishToGithub: true },
        runner
      )
    ).toEqual({ ok: false, error: 'gh: not logged in' })
  })
})

describe('quickStart:apply request validation', () => {
  function applyHandler(): (event: unknown, request: unknown) => unknown {
    handle.mockClear()
    registerQuickStartHandlers()
    const handler: unknown = handle.mock.calls.at(0)?.at(1)
    if (typeof handler !== 'function') {
      throw new Error('quickStart:apply was not registered')
    }
    return (event, request) => handler(event, request)
  }

  it('rejects malformed requests before running anything', () => {
    const apply = applyHandler()
    const invalid = { ok: false, error: 'Invalid request.' }
    expect(apply(null, null)).toEqual(invalid)
    expect(apply(null, { repoPath: '/p', name: 'bad name', template: 'none' })).toEqual(invalid)
    expect(apply(null, { repoPath: '/p', name: 'ok', template: 'vite' })).toEqual(invalid)
  })

  it('treats a missing publish flag as false', async () => {
    const apply = applyHandler()
    expect(await apply(null, { repoPath: '/p', name: 'ok', template: 'none' })).toEqual({
      ok: true
    })
  })
})
