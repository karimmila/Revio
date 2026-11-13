import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { removeEmptyProjectContainer } from './empty-project-container-removal'

let root: string
let repo: string
let workspaces: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'empty-project-container-'))
  repo = join(root, 'code', 'web-app')
  workspaces = join(root, 'workspaces')
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('removeEmptyProjectContainer', () => {
  it('removes the project’s folder once its last workspace is deleted', async () => {
    const container = join(workspaces, 'web-app')
    mkdirSync(container, { recursive: true })
    expect(await removeEmptyProjectContainer(join(container, 'oslo'), repo)).toBe(true)
    expect(existsSync(container)).toBe(false)
    expect(existsSync(workspaces)).toBe(true)
  })

  it('keeps a folder that still holds another workspace or any file', async () => {
    const container = join(workspaces, 'web-app')
    mkdirSync(join(container, 'lima'), { recursive: true })
    expect(await removeEmptyProjectContainer(join(container, 'oslo'), repo)).toBe(false)
    expect(existsSync(join(container, 'lima'))).toBe(true)
    rmSync(join(container, 'lima'), { recursive: true })
    writeFileSync(join(container, 'notes.txt'), 'mine')
    expect(await removeEmptyProjectContainer(join(container, 'oslo'), repo)).toBe(false)
    expect(existsSync(join(container, 'notes.txt'))).toBe(true)
  })

  it('never removes a folder the app did not name after the project', async () => {
    // A flat layout: the workspace sat directly in the workspace folder.
    mkdirSync(workspaces, { recursive: true })
    expect(await removeEmptyProjectContainer(join(workspaces, 'oslo'), repo)).toBe(false)
    expect(existsSync(workspaces)).toBe(true)
    // A worktree the person made beside their project, in an otherwise empty folder.
    const beside = join(root, 'elsewhere')
    mkdirSync(beside)
    expect(await removeEmptyProjectContainer(join(beside, 'feature'), repo)).toBe(false)
    expect(existsSync(beside)).toBe(true)
  })

  it('never removes the project itself', async () => {
    rmSync(repo, { recursive: true })
    mkdirSync(repo)
    expect(await removeEmptyProjectContainer(join(repo, '.worktrees'), repo)).toBe(false)
    expect(existsSync(repo)).toBe(true)
  })
})
