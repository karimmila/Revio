import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Repo } from '../../shared/repo-types'
import type {
  AsleepCloudChat,
  AsleepCloudWorkspace
} from '../../shared/asleep-cloud-workspace-types'
import type { ImportSourceChat, ImportSourceWorkspace } from '../../shared/workspace-import-types'
import type { ImportSourceSnapshot } from './import-source-database'
import { findClaudeTranscript } from './import-source-transcripts'
import { synthesizeClaudeTranscript } from './import-source-transcript-synthesis'
import { fetchMirrorCommit, readMirrorChanges } from './workspace-import-mirror'
import {
  PAYLOAD_BUNDLE_REF_PREFIX,
  addAsleepCloudTranscript,
  writeAsleepCloudPayload
} from './asleep-cloud-payload'
import {
  asleepCloudPayloadDir,
  findAsleepCloudWorkspace,
  saveAsleepCloudWorkspace
} from './asleep-cloud-store'

/** Ledger value for a source workspace that became an asleep cloud workspace. */
export const ASLEEP_CLOUD_LEDGER_PREFIX = 'asleep-cloud:'

export function asleepCloudIdOfLedgerEntry(entry: string | null): string | null {
  return entry?.startsWith(ASLEEP_CLOUD_LEDGER_PREFIX)
    ? entry.slice(ASLEEP_CLOUD_LEDGER_PREFIX.length)
    : null
}

export type AsleepChatOutcome =
  | { ok: true; chat: AsleepCloudChat }
  | { ok: false; reason: 'transcript-missing' | 'chat-failed' }

type ChatSource = {
  snapshot: Pick<ImportSourceSnapshot, 'readChatMessages'>
  source: ImportSourceWorkspace
  sourceHome: string
}

/**
 * Keeps a chat's conversation for the sandbox, recorded in the source workspace's folder (the
 * wake moves it to the sandbox's checkout). Only Claude chats can be continued there.
 */
async function keepChatTranscript(
  dir: string,
  from: ChatSource,
  chat: ImportSourceChat
): Promise<AsleepChatOutcome> {
  if (chat.agent !== 'claude') {
    return { ok: false, reason: 'chat-failed' }
  }
  const existing = await findClaudeTranscript(
    from.sourceHome,
    from.source.path,
    chat.providerSessionId
  )
  const contents = existing
    ? await readFile(existing, 'utf8')
    : synthesizeClaudeTranscript({
        rows: from.snapshot.readChatMessages(from.source, chat.sourceId),
        sessionId: chat.providerSessionId,
        cwd: from.source.path,
        gitBranch: from.source.branch
      })
  if (contents === '') {
    return { ok: false, reason: 'transcript-missing' }
  }
  try {
    addAsleepCloudTranscript(dir, chat.providerSessionId, contents)
  } catch {
    return { ok: false, reason: 'chat-failed' }
  }
  return {
    ok: true,
    chat: {
      agent: 'claude',
      providerSessionId: chat.providerSessionId,
      ...(chat.title.trim() !== '' ? { title: chat.title } : {})
    }
  }
}

/**
 * Records a source cloud workspace as an asleep Revio cloud workspace without starting a
 * sandbox: its branch and commit, plus a folder with its uncommitted work. Null when the
 * mirror cannot tell the commit, so the caller places it as a local worktree instead.
 */
export async function placeAsleepCloudWorkspace(input: {
  userDataDir: string
  repo: Repo
  source: ImportSourceWorkspace
  branch: string
}): Promise<AsleepCloudWorkspace | null> {
  const { source, repo } = input
  if (!source.mirrorPath) {
    return null
  }
  const changes = await readMirrorChanges(source.mirrorPath)
  const id = `imp-${randomUUID()}`
  const dir = asleepCloudPayloadDir(input.userDataDir, id)
  const haveCommit = await fetchMirrorCommit(repo.path, source.mirrorPath, changes.head)
  await writeAsleepCloudPayload({
    dir,
    repoPath: haveCommit ? repo.path : null,
    mirrorPath: source.mirrorPath,
    changes,
    sourceCwd: source.path,
    bundleRef: `${PAYLOAD_BUNDLE_REF_PREFIX}${id}`
  })
  const record: AsleepCloudWorkspace = {
    id,
    repoId: repo.id,
    displayName: source.name,
    branch: input.branch,
    commit: changes.head,
    chats: [],
    lastActivityAt: source.lastActivityAt
  }
  saveAsleepCloudWorkspace(input.userDataDir, record)
  return record
}

/** Adds a chat to an asleep workspace; it resumes there once the workspace wakes. */
export async function addChatToAsleepCloudWorkspace(
  userDataDir: string,
  id: string,
  from: ChatSource,
  chat: ImportSourceChat
): Promise<AsleepChatOutcome> {
  const record = findAsleepCloudWorkspace(userDataDir, id)
  if (!record) {
    // Already woken: it is a cloud workspace now, which the import does not reach into.
    return { ok: false, reason: 'chat-failed' }
  }
  const kept = await keepChatTranscript(asleepCloudPayloadDir(userDataDir, id), from, chat)
  if (!kept.ok) {
    return kept
  }
  if (!record.chats.some((entry) => entry.providerSessionId === chat.providerSessionId)) {
    saveAsleepCloudWorkspace(userDataDir, { ...record, chats: [...record.chats, kept.chat] })
  }
  return kept
}
