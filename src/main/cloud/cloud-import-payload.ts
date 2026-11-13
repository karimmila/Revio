import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Sandbox } from '@vercel/sandbox'
import type { AsleepCloudWakeChanges } from '../../shared/asleep-cloud-workspace-types'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { encodeClaudeProjectPath } from '../ai-vault/scanners/claude/claude-project-dir-encoding'
import { relocateTranscriptCwd } from '../workspace-import/import-source-transcripts'
import {
  PAYLOAD_BUNDLE,
  PAYLOAD_BUNDLE_REF_PREFIX,
  PAYLOAD_NEW_FILES,
  PAYLOAD_PATCH,
  PAYLOAD_TRANSCRIPTS,
  listAsleepCloudTranscripts,
  markAsleepCloudPayloadApplied,
  readAsleepCloudPayloadManifest,
  type AsleepCloudPayloadManifest
} from '../workspace-import/asleep-cloud-payload'
import { runSandboxScript } from './cloud-sandbox-run'

/** Where an imported workspace's files wait in the sandbox between the upload and the apply. */
export const IMPORT_STAGE_DIR = '/tmp/revio-import'

export type StagedImport = AsleepCloudPayloadManifest & { transcripts: number }

/**
 * Uploads what an imported cloud workspace kept on this Mac. Transcripts get the sandbox's
 * checkout as their `cwd`, as `claude --resume` only finds a session recorded in its own folder.
 * Null when the folder is gone (nothing to bring).
 */
export async function stageImportPayload(
  sandbox: Pick<Sandbox, 'writeFiles'>,
  payloadDir: string,
  repoDir: string,
  signal?: AbortSignal
): Promise<StagedImport | null> {
  const manifest = readAsleepCloudPayloadManifest(payloadDir)
  if (!manifest) {
    return null
  }
  const files: { path: string; content: string | Uint8Array }[] = []
  const add = (relative: string, content?: string): void => {
    files.push({
      path: `${IMPORT_STAGE_DIR}/${relative}`,
      content: content ?? readFileSync(join(payloadDir, relative))
    })
  }
  if (manifest.patch) {
    add(PAYLOAD_PATCH)
  }
  for (const path of manifest.untracked) {
    add(`${PAYLOAD_NEW_FILES}/${path}`)
  }
  if (manifest.bundle) {
    add(PAYLOAD_BUNDLE)
  }
  const transcripts = listAsleepCloudTranscripts(payloadDir)
  for (const id of transcripts) {
    const relative = `${PAYLOAD_TRANSCRIPTS}/${id}.jsonl`
    const contents = readFileSync(join(payloadDir, relative), 'utf8')
    add(relative, relocateTranscriptCwd(contents, manifest.sourceCwd, repoDir))
  }
  if (files.length > 0) {
    await sandbox.writeFiles(files, { signal })
  }
  return { ...manifest, transcripts: transcripts.length }
}

/**
 * Runs before the checkout: the bundle carries the commits GitHub may not have, so the
 * workspace's own commit can be checked out. Its prerequisites are origin's branches.
 */
export function importBundleFetch(staged: StagedImport | null): string {
  if (!staged?.bundle) {
    return ''
  }
  const refs = quotePosixShell(`+${PAYLOAD_BUNDLE_REF_PREFIX}*:${PAYLOAD_BUNDLE_REF_PREFIX}*`)
  return [
    'GIT_TERMINAL_PROMPT=0 git fetch --quiet origin 2>/dev/null || true',
    `git fetch --quiet ${IMPORT_STAGE_DIR}/${PAYLOAD_BUNDLE} ${refs} 2>/dev/null || true`,
    ''
  ].join('\n')
}

const OUTCOME_MARK = 'REVIO_IMPORT_CHANGES='

/** Applies the diff and adds the new files; a diff that does not apply is kept in `.revio-import/`. */
export function importChangesScript(stage = IMPORT_STAGE_DIR): string {
  return `out=none
if [ -f ${stage}/${PAYLOAD_PATCH} ] || [ -d ${stage}/${PAYLOAD_NEW_FILES} ]; then out=applied; fi
if [ -f ${stage}/${PAYLOAD_PATCH} ] && ! git apply --binary --whitespace=nowarn ${stage}/${PAYLOAD_PATCH}; then out=kept-aside; fi
if [ "$out" = applied ]; then
  if [ -d ${stage}/${PAYLOAD_NEW_FILES} ]; then cp -Rn ${stage}/${PAYLOAD_NEW_FILES}/. ./; fi
elif [ "$out" = kept-aside ]; then
  mkdir -p .revio-import
  printf '*\\n' > .revio-import/.gitignore
  cp ${stage}/${PAYLOAD_PATCH} .revio-import/uncommitted-changes.patch
  if [ -d ${stage}/${PAYLOAD_NEW_FILES} ]; then cp -R ${stage}/${PAYLOAD_NEW_FILES} .revio-import/new-files; fi
fi
echo "${OUTCOME_MARK}$out"
`
}

/**
 * Puts each transcript in the Claude projects folder of the user the chats run as (ubuntu, the
 * SSH user Orca's server runs under), keeping one already there.
 */
export function importTranscriptsScript(repoDir: string): string {
  const bucket = quotePosixShell(encodeClaudeProjectPath(repoDir))
  return `set -e
u=ubuntu
id -u "$u" >/dev/null 2>&1 || u=$(stat -c %U ${quotePosixShell(repoDir)})
h=$(getent passwd "$u" | cut -d: -f6)
d="$h/.claude/projects/"${bucket}
install -d -o "$u" -g "$u" -m 700 "$h/.claude" "$h/.claude/projects" "$d"
for f in ${IMPORT_STAGE_DIR}/${PAYLOAD_TRANSCRIPTS}/*.jsonl; do
  [ -e "$f" ] || continue
  t="$d/$(basename "$f")"
  [ -e "$t" ] || install -o "$u" -g "$u" -m 600 "$f" "$t"
done
`
}

export function parseImportChanges(output: string): AsleepCloudWakeChanges {
  const line = output
    .split('\n')
    .toReversed()
    .find((entry) => entry.startsWith(OUTCOME_MARK))
  const value = line?.slice(OUTCOME_MARK.length).trim()
  return value === 'applied' || value === 'kept-aside' ? value : 'none'
}

/**
 * Runs after the checkout. Only once the sandbox holds everything is the Mac's copy marked as
 * applied, which lets the app delete it.
 */
export async function applyStagedImport(
  sandbox: Sandbox,
  staged: StagedImport,
  payloadDir: string,
  repoDir: string,
  options: { signal?: AbortSignal; log: (text: string) => void }
): Promise<AsleepCloudWakeChanges> {
  const output = await runSandboxScript(sandbox, importChangesScript(), {
    cwd: repoDir,
    signal: options.signal
  })
  const changes = parseImportChanges(output)
  if (staged.transcripts > 0) {
    await runSandboxScript(sandbox, importTranscriptsScript(repoDir), {
      sudo: true,
      signal: options.signal
    })
  }
  await runSandboxScript(sandbox, `rm -rf ${IMPORT_STAGE_DIR}`, {
    sudo: true,
    signal: options.signal
  })
  options.log(
    changes === 'kept-aside'
      ? 'The imported changes did not apply; they are in .revio-import\n'
      : `Imported changes: ${changes}\n`
  )
  markAsleepCloudPayloadApplied(payloadDir, changes)
  return changes
}

export type ImportedWorkspaceStep = {
  /** Shell lines run before the checkout. */
  beforeCheckout: string
  afterCheckout: (log: (text: string) => void) => Promise<void>
}

const NO_IMPORT: ImportedWorkspaceStep = { beforeCheckout: '', afterCheckout: async () => {} }

/** The create's part for an imported workspace's wake; nothing for any other create. */
export async function importedWorkspaceStep(
  sandbox: Sandbox,
  payloadDir: string | undefined,
  repoDir: string,
  signal?: AbortSignal
): Promise<ImportedWorkspaceStep> {
  const staged = payloadDir ? await stageImportPayload(sandbox, payloadDir, repoDir, signal) : null
  if (!staged || !payloadDir) {
    return NO_IMPORT
  }
  return {
    beforeCheckout: importBundleFetch(staged),
    afterCheckout: async (log) => {
      await applyStagedImport(sandbox, staged, payloadDir, repoDir, { signal, log })
    }
  }
}
