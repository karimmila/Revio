import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { readEnvVarFiles, setEnvVarFilesLookup } from './env-var-files'

let dir: string | null = null
afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
  }
})

it("loads the repository's env files from the workspace, later files winning, missing ones skipped", () => {
  dir = mkdtempSync(join(tmpdir(), 'orca-env-files-'))
  writeFileSync(join(dir, '.env'), 'A=1\nB=base\n')
  writeFileSync(join(dir, '.env.local'), 'B=local\n')
  setEnvVarFilesLookup((repoId) => (repoId === 'r' ? ['.env', 'missing.env', '.env.local'] : []))
  expect(readEnvVarFiles('r', dir)).toEqual({ A: '1', B: 'local' })
  expect(readEnvVarFiles('other', dir)).toEqual({})
})
