import { describe, expect, it, vi } from 'vitest'
import { renameBranchTo } from './branch-rename'

describe('renameBranchTo', () => {
  it('renames to the normalized name git accepts', async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === 'check-ref-format') {
        return { stdout: 'feature/new-name\n' }
      }
      if (args[0] === 'show-ref') {
        throw new Error('missing')
      }
      return { stdout: '' }
    })
    await expect(renameBranchTo(exec, ' feature/new-name ')).resolves.toBe('feature/new-name')
    expect(exec).toHaveBeenCalledWith(['branch', '-m', 'feature/new-name'])
  })

  it('refuses a name another branch already uses instead of suffixing it', async () => {
    const exec = vi.fn(async (args: string[]) =>
      args[0] === 'check-ref-format' ? { stdout: 'taken\n' } : { stdout: '' }
    )
    await expect(renameBranchTo(exec, 'taken')).rejects.toThrow('already exists')
    expect(exec).not.toHaveBeenCalledWith(['branch', '-m', 'taken'])
  })
})
