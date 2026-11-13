import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { AsleepCloudWakeChanges } from '../../shared/asleep-cloud-workspace-types'
import { git } from './workspace-import-git'
import { isImportableMirrorFile, type MirrorChanges } from './workspace-import-mirror'

/**
 * What an imported cloud workspace keeps on this Mac until its sandbox exists: the uncommitted
 * diff, the new files, the commits GitHub may not have (a git bundle), and the chats' Claude
 * transcripts. Waking copies all of it into the sandbox; only then is the folder deleted.
 */
const MANIFEST = 'manifest.json'
const OUTCOME = 'outcome.json'
export const PAYLOAD_PATCH = 'changes.patch'
export const PAYLOAD_NEW_FILES = 'new-files'
export const PAYLOAD_BUNDLE = 'commits.bundle'
export const PAYLOAD_TRANSCRIPTS = 'transcripts'
/** The bundle's one ref; the sandbox fetches it so the workspace's commit is there to check out. */
export const PAYLOAD_BUNDLE_REF_PREFIX = 'refs/revio-import/'

const SESSION_ID = /^[\w-]{1,128}$/

const ManifestSchema = z.object({
  /** The folder the chats ran in, which their transcripts record as `cwd`. */
  sourceCwd: z.string(),
  patch: z.boolean(),
  untracked: z.array(z.string()),
  bundle: z.boolean()
})
export type AsleepCloudPayloadManifest = z.infer<typeof ManifestSchema>

async function writeCommitBundle(
  repoPath: string,
  head: string,
  target: string,
  ref: string
): Promise<boolean> {
  try {
    await git(repoPath, ['update-ref', ref, head])
  } catch {
    return false
  }
  try {
    // Only what origin lacks; git refuses an empty bundle, which means GitHub has every commit.
    await git(repoPath, ['bundle', 'create', '--quiet', target, ref, '--not', '--remotes=origin'])
    return true
  } catch {
    return false
  } finally {
    await git(repoPath, ['update-ref', '-d', ref]).catch(() => undefined)
  }
}

export async function writeAsleepCloudPayload(input: {
  dir: string
  /** The project clone, which already holds the workspace's commit. */
  repoPath: string | null
  mirrorPath: string
  changes: MirrorChanges
  sourceCwd: string
  bundleRef: string
}): Promise<void> {
  const { dir, changes } = input
  await mkdir(dir, { recursive: true })
  if (changes.patch !== '') {
    await writeFile(join(dir, PAYLOAD_PATCH), changes.patch)
  }
  // The payload is uploaded to a sandbox, so a symlink's target must never be read into it.
  const untracked: string[] = []
  for (const path of changes.untracked) {
    if (!(await isImportableMirrorFile(input.mirrorPath, path))) {
      continue
    }
    untracked.push(path)
    const target = join(dir, PAYLOAD_NEW_FILES, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(join(input.mirrorPath, path)))
  }
  const bundle = input.repoPath
    ? await writeCommitBundle(
        input.repoPath,
        changes.head,
        join(dir, PAYLOAD_BUNDLE),
        input.bundleRef
      )
    : false
  const manifest: AsleepCloudPayloadManifest = {
    sourceCwd: input.sourceCwd,
    patch: changes.patch !== '',
    untracked,
    bundle
  }
  await writeFile(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Keeps a chat's transcript for the sandbox; a session already kept is left as it is. */
export function addAsleepCloudTranscript(dir: string, sessionId: string, contents: string): void {
  if (!SESSION_ID.test(sessionId)) {
    throw new Error('Unexpected chat session id.')
  }
  const target = join(dir, PAYLOAD_TRANSCRIPTS, `${sessionId}.jsonl`)
  if (existsSync(target)) {
    return
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

export function readAsleepCloudPayloadManifest(dir: string): AsleepCloudPayloadManifest | null {
  try {
    const parsed = ManifestSchema.safeParse(JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function listAsleepCloudTranscripts(dir: string): string[] {
  try {
    return readdirSync(join(dir, PAYLOAD_TRANSCRIPTS))
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => name.slice(0, -'.jsonl'.length))
      .filter((id) => SESSION_ID.test(id))
  } catch {
    return []
  }
}

/** Written once the sandbox holds everything; until then the folder must stay. */
export function markAsleepCloudPayloadApplied(dir: string, changes: AsleepCloudWakeChanges): void {
  writeFileSync(join(dir, OUTCOME), `${JSON.stringify({ changes })}\n`)
}

/**
 * Before each wake: an outcome left by a wake that failed later must not let the next wake, which
 * may not apply the payload, delete the Mac's only copy.
 */
export function clearAsleepCloudPayloadOutcome(dir: string): void {
  rmSync(join(dir, OUTCOME), { force: true })
}

export function readAsleepCloudPayloadOutcome(dir: string): AsleepCloudWakeChanges | null {
  try {
    const parsed = z
      .object({ changes: z.enum(['none', 'applied', 'kept-aside']) })
      .safeParse(JSON.parse(readFileSync(join(dir, OUTCOME), 'utf8')))
    return parsed.success ? parsed.data.changes : null
  } catch {
    return null
  }
}
