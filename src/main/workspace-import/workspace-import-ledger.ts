import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomically } from '../codex-accounts/fs-utils'

/** Source ids already brought over, so a second run only adds what is new. */
export type WorkspaceImportLedger = {
  /** Source workspace id → Revio worktree id. */
  workspaces: Record<string, string>
  /** Source chat id → Revio chat session id. */
  chats: Record<string, string>
}

const LEDGER_FILE = 'workspace-import-ledger.json'

export function emptyWorkspaceImportLedger(): WorkspaceImportLedger {
  return { workspaces: {}, chats: {} }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

export function readWorkspaceImportLedger(userDataDir: string): WorkspaceImportLedger {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(userDataDir, LEDGER_FILE), 'utf8'))
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return { workspaces: stringRecord(record.workspaces), chats: stringRecord(record.chats) }
  } catch {
    return emptyWorkspaceImportLedger()
  }
}

export function writeWorkspaceImportLedger(
  userDataDir: string,
  ledger: WorkspaceImportLedger
): void {
  writeFileAtomically(join(userDataDir, LEDGER_FILE), `${JSON.stringify(ledger, null, 2)}\n`)
}
