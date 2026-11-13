import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ipcMain } from 'electron'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { AgentConfigItem, SyncAgent, SyncKind } from '../../shared/agent-config-sync-types'
import { isSafeConfigName, planAgentConfigSync } from '../../shared/agent-config-sync-plan'

// Claude: ~/.claude/skills/<name>/ and ~/.claude/commands/<name>.md.
// Codex: ~/.codex/skills/<name>/ and ~/.codex/prompts/<name>.md (its custom slash commands).
function folder(settings: GlobalSettings, agent: SyncAgent, kind: SyncKind): string {
  if (agent === 'claude') {
    const root = settings.agentDefaultEnv?.claude?.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
    return join(root, kind === 'skill' ? 'skills' : 'commands')
  }
  const root =
    settings.agentDefaultEnv?.codex?.CODEX_HOME ??
    process.env.CODEX_HOME ??
    join(homedir(), '.codex')
  return join(root, kind === 'skill' ? 'skills' : 'prompts')
}

const SYNC_KINDS: readonly SyncKind[] = ['skill', 'command']

async function fingerprint(path: string): Promise<string> {
  try {
    return createHash('sha256')
      .update(await readFile(path))
      .digest('hex')
  } catch {
    return ''
  }
}

async function readSide(dir: string, kind: SyncKind): Promise<Map<string, string>> {
  const side = new Map<string, string>()
  let entries: { name: string; isDirectory: () => boolean }[] = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return side
  }
  for (const entry of entries) {
    if (kind === 'skill' && entry.isDirectory() && isSafeConfigName(entry.name)) {
      side.set(entry.name, await fingerprint(join(dir, entry.name, 'SKILL.md')))
    }
    if (kind === 'command' && !entry.isDirectory() && entry.name.endsWith('.md')) {
      const name = entry.name.slice(0, -'.md'.length)
      if (isSafeConfigName(name)) {
        side.set(name, await fingerprint(join(dir, entry.name)))
      }
    }
  }
  return side
}

export async function listAgentConfigs(settings: GlobalSettings): Promise<AgentConfigItem[]> {
  const rows: AgentConfigItem[] = []
  for (const kind of SYNC_KINDS) {
    const [claude, codex] = await Promise.all([
      readSide(folder(settings, 'claude', kind), kind),
      readSide(folder(settings, 'codex', kind), kind)
    ])
    rows.push(...planAgentConfigSync(kind, claude, codex))
  }
  return rows
}

/** Copies one item to the other agent; an existing copy is replaced only with `overwrite`. */
export async function copyAgentConfig(
  settings: GlobalSettings,
  kind: SyncKind,
  name: string,
  to: SyncAgent,
  overwrite: boolean
): Promise<void> {
  if (!isSafeConfigName(name)) {
    throw new Error('Invalid name.')
  }
  const from: SyncAgent = to === 'claude' ? 'codex' : 'claude'
  const file = kind === 'skill' ? name : `${name}.md`
  const source = join(folder(settings, from, kind), file)
  const targetDir = folder(settings, to, kind)
  const target = join(targetDir, file)
  await mkdir(targetDir, { recursive: true })
  if (overwrite) {
    await rm(target, { recursive: true, force: true })
  }
  await cp(source, target, { recursive: true, errorOnExist: true, force: false })
}

export function registerAgentConfigSyncHandlers(getSettings: () => GlobalSettings): void {
  ipcMain.handle('agentConfigSync:list', () => listAgentConfigs(getSettings()))
  ipcMain.handle(
    'agentConfigSync:copy',
    async (_event, kind: unknown, name: unknown, to: unknown, overwrite: unknown) => {
      if ((kind !== 'skill' && kind !== 'command') || typeof name !== 'string') {
        throw new Error('Invalid item.')
      }
      if (to !== 'claude' && to !== 'codex') {
        throw new Error('Invalid agent.')
      }
      await copyAgentConfig(getSettings(), kind, name, to, overwrite === true)
      return listAgentConfigs(getSettings())
    }
  )
}
