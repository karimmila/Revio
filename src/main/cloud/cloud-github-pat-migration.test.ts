import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const root = vi.hoisted(() => ({ dir: '' }))
vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => root.dir }))

import {
  dismissGithubMigrationNotice,
  githubMigrationNoticePending,
  migrateGithubPatFiles
} from './cloud-github-pat-migration'

beforeEach(() => {
  root.dir = mkdtempSync(join(tmpdir(), 'gh-pat-migration-'))
})

afterEach(() => {
  rmSync(root.dir, { recursive: true, force: true })
})

describe('fine-grained token migration', () => {
  it('deletes the sealed per-owner tokens and asks once to sign in again', () => {
    mkdirSync(join(root.dir, 'github'))
    writeFileSync(join(root.dir, 'github', 'acme.enc'), 'orca-cloud-github:v1:sealed:xxx')
    expect(migrateGithubPatFiles()).toBe(true)
    expect(existsSync(join(root.dir, 'github'))).toBe(false)
    expect(githubMigrationNoticePending()).toBe(true)
    expect(migrateGithubPatFiles()).toBe(false)
    dismissGithubMigrationNotice()
    expect(githubMigrationNoticePending()).toBe(false)
  })

  it('says nothing when there was no token', () => {
    expect(migrateGithubPatFiles()).toBe(false)
    mkdirSync(join(root.dir, 'github'))
    expect(migrateGithubPatFiles()).toBe(false)
    expect(githubMigrationNoticePending()).toBe(false)
  })
})
