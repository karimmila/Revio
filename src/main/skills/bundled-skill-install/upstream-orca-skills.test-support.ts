import { lstat, mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { linkDirectory, writeCopy, type SkillHome } from './skill-home.test-support'

const FIXTURE_DIRECTORY = import.meta.dirname

/**
 * Copies upstream Orca.app owns on a machine that also runs this fork. The orca-cli,
 * orca-computer-use and orchestration texts are the exact bytes a dev build wrote over Orca's
 * copies; the other two are older Orca releases. Every digest is in Orca's ledger entries.
 */
export const UPSTREAM_ORCA_FIXTURES = {
  'orca-cli': 'orca-cli-revio-text.skill-md.txt',
  'orca-computer-use': 'orca-computer-use-revio-text.skill-md.txt',
  orchestration: 'orchestration-revio-text.skill-md.txt',
  'computer-use': 'computer-use-before-rename.skill-md.txt'
} as const

export const OLDEST_ORCA_ORCHESTRATION = 'orchestration-v1.3.24-rc.2.skill-md.txt'

export type UpstreamOrcaSkillName = keyof typeof UPSTREAM_ORCA_FIXTURES

export function readUpstreamFixture(file: string): Promise<string> {
  return readFile(join(FIXTURE_DIRECTORY, file), 'utf8')
}

export const sharedSkillPath = (home: SkillHome, name: string) => join(dirname(home.shared), name)
export const claudeSkillPath = (home: SkillHome, name: string) => join(dirname(home.claude), name)

/** The npx layout Orca.app leaves: a shared copy, linked into ~/.claude/skills. */
export async function installUpstreamOrcaCopies(home: SkillHome): Promise<string[]> {
  const paths: string[] = []
  await mkdir(dirname(home.claude), { recursive: true })
  for (const [name, file] of Object.entries(UPSTREAM_ORCA_FIXTURES)) {
    const shared = sharedSkillPath(home, name)
    await writeCopy(shared, await readUpstreamFixture(file))
    await linkDirectory(shared, claudeSkillPath(home, name))
    paths.push(shared, claudeSkillPath(home, name))
  }
  return paths
}

/** Identity plus bytes: a swap, rename or rewrite changes the inode or the content. */
export async function byteSnapshot(paths: readonly string[]): Promise<string[]> {
  const out: string[] = []
  for (const path of paths) {
    const stat = await lstat(path)
    const entries = stat.isDirectory() ? (await readdir(path)).sort().join(',') : ''
    const skill = await readFile(join(path, 'SKILL.md')).catch(() => Buffer.alloc(0))
    out.push(`${path}|${stat.ino}|${stat.isSymbolicLink()}|${entries}|${skill.toString('base64')}`)
  }
  return out
}

/** Every entry under the home, so a test can prove nothing was created or moved. */
export async function homeTree(root: string): Promise<string[]> {
  const out: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      out.push(path)
      if (entry.isDirectory()) {
        await visit(path)
      }
    }
  }
  await visit(root)
  return out.sort()
}
