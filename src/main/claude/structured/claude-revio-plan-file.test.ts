import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { revioPlanSlug, revioPlanTitle, saveRevioPlan } from './claude-revio-plan-file'

describe('Plan names', () => {
  it('titles a plan by its first heading, else its first line, without "Plan:"', () => {
    expect(revioPlanTitle('intro\n## Plan: Fix the login loop\n- a')).toBe('Fix the login loop')
    expect(revioPlanTitle('\n  Refactor billing  \nmore')).toBe('Refactor billing')
    expect(revioPlanTitle('#### too deep')).toBe('#### too deep')
    expect(revioPlanTitle('   ')).toBe('Untitled')
  })

  it('slugs the title to lowercase dashes, at most 50 characters', () => {
    expect(revioPlanSlug('# Fix: the *login* loop!')).toBe('fix-the-login-loop')
    expect(revioPlanSlug(`# ${'a'.repeat(80)}`)).toHaveLength(50)
    expect(revioPlanSlug('# ¿¿??')).toBe('untitled')
  })
})

describe('saveRevioPlan', () => {
  let workspace: string
  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'orca-plan-'))
  })
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it('writes .context/plans/<slug>.md and keeps a new .context out of Git', async () => {
    const saved = await saveRevioPlan(workspace, '# Fix login\n\n1. Do it')
    expect(saved).toBe(join(workspace, '.context', 'plans', 'fix-login.md'))
    expect(await readFile(saved ?? '', 'utf8')).toBe('# Fix login\n\n1. Do it')
    expect(await readFile(join(workspace, '.context', '.gitignore'), 'utf8')).toBe('*\n')
  })

  it('leaves an existing .context as it is and replaces a plan with the same title', async () => {
    await mkdir(join(workspace, '.context'))
    await writeFile(join(workspace, '.context', 'notes.md'), 'kept')
    await saveRevioPlan(workspace, '# Same\nfirst')
    const saved = await saveRevioPlan(workspace, '# Same\nsecond')
    expect(await readFile(saved ?? '', 'utf8')).toBe('# Same\nsecond')
    await expect(stat(join(workspace, '.context', '.gitignore'))).rejects.toThrow()
  })

  it('saves nothing for an empty plan', async () => {
    expect(await saveRevioPlan(workspace, '  \n')).toBeNull()
    await expect(stat(join(workspace, '.context'))).rejects.toThrow()
  })
})
