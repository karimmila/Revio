import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FORK_HOME_FOLDER_NAME } from '../shared/fork-identity'
import {
  decideHomeConfigDir,
  homeConfigDir,
  homeConfigDirName,
  resetHomeConfigDirForTests
} from './home-config-dir'

const OWN = `.${FORK_HOME_FOLDER_NAME}`

describe('home config folder', () => {
  let home: string
  let userDataPath: string

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), 'home-config-dir-'))
    home = join(root, 'home')
    userDataPath = join(root, 'user-data')
    mkdirSync(home)
    resetHomeConfigDirForTests()
  })

  afterEach(() => {
    resetHomeConfigDirForTests()
    rmSync(join(home, '..'), { recursive: true, force: true })
  })

  it("stays on upstream's folder until the packaged app decides", () => {
    expect(homeConfigDirName()).toBe('.orca')
    expect(homeConfigDir(home)).toBe(join(home, '.orca'))
  })

  it("gives a new profile its own folder, even beside a real upstream install's", () => {
    mkdirSync(join(home, '.orca'))
    expect(decideHomeConfigDir({ userDataPath, home })).toBe(OWN)
    expect(OWN).not.toBe('.orca')
    expect(homeConfigDir(home)).toBe(join(home, OWN))
    expect(readFileSync(join(userDataPath, 'home-config-dir'), 'utf8').trim()).toBe(OWN)
  })

  it('keeps a profile from an older build on the folder its files are in', () => {
    mkdirSync(join(home, '.orca'))
    mkdirSync(userDataPath)
    writeFileSync(join(userDataPath, 'orca-data.json'), '{}')
    expect(decideHomeConfigDir({ userDataPath, home })).toBe('.orca')
    expect(homeConfigDirName()).toBe('.orca')
  })

  it('moves an older profile to its own folder when it has nothing in the old one', () => {
    mkdirSync(userDataPath)
    writeFileSync(join(userDataPath, 'orca-data.json'), '{}')
    expect(decideHomeConfigDir({ userDataPath, home })).toBe(OWN)
  })

  it('never flips a profile once it has chosen', () => {
    expect(decideHomeConfigDir({ userDataPath, home })).toBe(OWN)
    // Later the profile has state and an upstream install appears: the choice stands.
    writeFileSync(join(userDataPath, 'orca-data.json'), '{}')
    mkdirSync(join(home, '.orca'))
    resetHomeConfigDirForTests()
    expect(decideHomeConfigDir({ userDataPath, home })).toBe(OWN)
  })

  it('ignores a damaged choice file', () => {
    mkdirSync(userDataPath)
    writeFileSync(join(userDataPath, 'home-config-dir'), '../../etc\n')
    expect(decideHomeConfigDir({ userDataPath, home })).toBe(OWN)
  })
})
