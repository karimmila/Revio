import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FORK_HOME_FOLDER_NAME, LEGACY_HOME_FOLDER_NAME } from '../shared/fork-identity'

const LEGACY_NAME = `.${LEGACY_HOME_FOLDER_NAME}`
const FORK_NAME = `.${FORK_HOME_FOLDER_NAME}`
/** In userData: the name this profile settled on, so the choice never flips between launches. */
const CHOICE_FILE = 'home-config-dir'
/** The profile's state file; present means an earlier build already ran with this profile. */
const PROFILE_STATE_FILE = 'orca-data.json'

let decided: string | null = null

/**
 * Picks this profile's config folder in the home directory, where saved credentials and
 * keybindings.json live. The packaged app calls it once at startup, before anything reads a path.
 *
 * Upstream keeps the same files in ~/.orca. Sharing that folder with a real install breaks both
 * apps: each encrypts credentials with its own Keychain key, so neither can read the other's and
 * each overwrites them. A new profile therefore gets its own folder. A profile from an older build
 * that already keeps its files in ~/.orca stays there, so an update does not lose them.
 */
export function decideHomeConfigDir(args: { userDataPath: string; home?: string }): string {
  const home = args.home ?? homedir()
  const choicePath = join(args.userDataPath, CHOICE_FILE)
  const saved = readChoice(choicePath)
  if (saved) {
    decided = saved
    return saved
  }
  const olderProfile = existsSync(join(args.userDataPath, PROFILE_STATE_FILE))
  const name =
    olderProfile && existsSync(join(home, LEGACY_NAME)) && !existsSync(join(home, FORK_NAME))
      ? LEGACY_NAME
      : FORK_NAME
  try {
    mkdirSync(args.userDataPath, { recursive: true })
    writeFileSync(choicePath, `${name}\n`, 'utf8')
  } catch (error) {
    // The choice is recomputed next launch; by then the new folder exists and wins again.
    console.warn('[home-config-dir] could not save the choice:', error)
  }
  decided = name
  return name
}

function readChoice(choicePath: string): string | null {
  try {
    const value = readFileSync(choicePath, 'utf8').trim()
    return value === LEGACY_NAME || value === FORK_NAME ? value : null
  } catch {
    return null
  }
}

/**
 * The config folder's name. Until the packaged app decides (dev builds, tests, the CLI and remote
 * servers never do) it is upstream's, which keeps those on the folder they have always used.
 */
export function homeConfigDirName(): string {
  return decided ?? LEGACY_NAME
}

export function homeConfigDir(home: string = homedir()): string {
  return join(home, homeConfigDirName())
}

export function resetHomeConfigDirForTests(): void {
  decided = null
}
