import { mkdtemp, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './index'

let root: string

describe('skills install from a development build', () => {
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'orca-cli-dev-skills-')))
    vi.stubEnv('HOME', root)
    vi.stubEnv('USERPROFILE', root)
    vi.stubEnv('ORCA_USER_DATA_PATH', join(root, 'user-data'))
    vi.stubEnv('ORCA_CLI_CWD', '')
    process.exitCode = undefined
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    process.exitCode = undefined
    await rm(root, { recursive: true, force: true })
  })

  // The unit setup installs an unpackaged AppEnvironment, as `pnpm dev` does.
  it.each(['install', 'update'])('refuses %s before touching the home folder', async (verb) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await main(['skills', verb, '--skill', 'revio-cli', '--agent', 'claude'], root)

    expect(process.exitCode).toBe(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('A development build does not')
    expect(await readdir(root)).toEqual([])
  })
})
