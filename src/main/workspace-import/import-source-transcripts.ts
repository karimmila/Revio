import { access, cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { encodeClaudeProjectPath } from '../ai-vault/scanners/claude/claude-project-dir-encoding'

/** Dev and test runs read transcripts from a copy instead of the real Claude home. */
export const IMPORT_SOURCE_CLAUDE_HOME_ENV = 'ORCA_IMPORT_SOURCE_CLAUDE_HOME'

export function importSourceClaudeHome(env: NodeJS.ProcessEnv = process.env): string {
  return env[IMPORT_SOURCE_CLAUDE_HOME_ENV] || join(homedir(), '.claude')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** A file already there is kept; false tells the caller nothing was written. */
async function writeNewFile(path: string, contents: string): Promise<boolean> {
  try {
    await writeFile(path, contents, { flag: 'wx' })
    return true
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      return false
    }
    throw error
  }
}

/** The transcript sits in the bucket of the folder the chat ran in; a moved folder is found by scan. */
export async function findClaudeTranscript(
  claudeHome: string,
  workspacePath: string,
  sessionId: string
): Promise<string | null> {
  const projects = join(claudeHome, 'projects')
  const fileName = `${sessionId}.jsonl`
  const expected = join(projects, encodeClaudeProjectPath(workspacePath), fileName)
  if (await exists(expected)) {
    return expected
  }
  let buckets: string[]
  try {
    buckets = await readdir(projects)
  } catch {
    return null
  }
  for (const bucket of buckets) {
    const candidate = join(projects, bucket, fileName)
    if (await exists(candidate)) {
      return candidate
    }
  }
  return null
}

async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    return (await realpath(a)) === (await realpath(b))
  } catch {
    return false
  }
}

/**
 * Chat adoption only accepts a transcript recorded in the workspace's own folder, so the copy's
 * `cwd` fields move from the old folder to the new one; the source file keeps its own.
 */
export function relocateTranscriptCwd(contents: string, from: string, to: string): string {
  if (from === to) {
    return contents
  }
  return contents
    .split('\n')
    .map((line) => {
      if (!line.includes('"cwd"')) {
        return line
      }
      try {
        const entry: unknown = JSON.parse(line)
        if (!entry || typeof entry !== 'object' || !('cwd' in entry)) {
          return line
        }
        const cwd = entry.cwd
        if (typeof cwd !== 'string' || (cwd !== from && !cwd.startsWith(`${from}/`))) {
          return line
        }
        return JSON.stringify({ ...entry, cwd: to + cwd.slice(from.length) })
      } catch {
        return line
      }
    })
    .join('\n')
}

export type TranscriptPlacement = 'copied' | 'already-present'

/**
 * `claude --resume` only finds a session in the bucket of the folder it runs in, under the config
 * home it runs with. Copies the transcript (and its subagent and tool-output folder) there; the
 * source is never moved or changed, and a file already at the target is kept as it is.
 */
export async function placeClaudeTranscriptForResume(input: {
  sourceFile: string
  /** The folder the conversation ran in, which its lines record. */
  sourceCwd: string
  sessionId: string
  targetHome: string
  workspacePath: string
}): Promise<TranscriptPlacement> {
  const bucket = join(input.targetHome, 'projects', encodeClaudeProjectPath(input.workspacePath))
  const target = join(bucket, `${input.sessionId}.jsonl`)
  if ((await exists(target)) || (await sameFile(input.sourceFile, target))) {
    return 'already-present'
  }
  await mkdir(bucket, { recursive: true })
  const contents = await readFile(input.sourceFile, 'utf8')
  const relocated = relocateTranscriptCwd(contents, input.sourceCwd, input.workspacePath)
  if (!(await writeNewFile(target, relocated))) {
    return 'already-present'
  }
  const sidecar = input.sourceFile.replace(/\.jsonl$/, '')
  if (await exists(sidecar)) {
    await cp(sidecar, join(bucket, input.sessionId), {
      recursive: true,
      force: false,
      errorOnExist: false
    })
  }
  return 'copied'
}

/** Writes a rebuilt transcript where `--resume` looks; an existing file there is kept. */
export async function writeClaudeTranscriptForResume(input: {
  contents: string
  sessionId: string
  targetHome: string
  workspacePath: string
}): Promise<TranscriptPlacement> {
  const bucket = join(input.targetHome, 'projects', encodeClaudeProjectPath(input.workspacePath))
  const target = join(bucket, `${input.sessionId}.jsonl`)
  if (await exists(target)) {
    return 'already-present'
  }
  await mkdir(bucket, { recursive: true })
  return (await writeNewFile(target, input.contents)) ? 'copied' : 'already-present'
}
