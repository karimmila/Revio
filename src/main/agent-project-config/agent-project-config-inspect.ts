import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentProjectConfigItem } from '../../shared/agent-project-config-trust'

/** The project files Claude Code loads on its own when a chat starts in the folder. */
const SETTINGS_FILES = ['.claude/settings.json', '.claude/settings.local.json'] as const
const MCP_FILE = '.mcp.json'
const MAX_FILE_BYTES = 1024 * 1024
const MAX_DETAIL_LENGTH = 200

/** Settings keys whose value is a command Claude Code runs by itself. */
const COMMAND_KEYS = ['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'otelHeadersHelper']
const MCP_SWITCH_KEYS = ['enableAllProjectMcpServers', 'enabledMcpjsonServers']
const PLUGIN_KEYS = ['enabledPlugins', 'extraKnownMarketplaces']

export type InspectedAgentProjectConfig = {
  items: AgentProjectConfigItem[]
  /** Names the exact bytes of every inspected file, so any edit is a new decision. */
  hash: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function detail(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, MAX_DETAIL_LENGTH) : undefined
}

function readSmallFile(path: string): string | null {
  try {
    return statSync(path).size <= MAX_FILE_BYTES ? readFileSync(path, 'utf8') : ''
  } catch {
    return null
  }
}

function commandsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(commandsOf)
  }
  const record = asRecord(value)
  if (!record) {
    return []
  }
  const own = detail(record.command)
  return [...(own ? [own] : []), ...commandsOf(record.hooks)]
}

function settingsItems(file: string, settings: Record<string, unknown>): AgentProjectConfigItem[] {
  const items: AgentProjectConfigItem[] = []
  for (const [event, matchers] of Object.entries(asRecord(settings.hooks) ?? {})) {
    const commands = commandsOf(matchers)
    for (const command of commands.length > 0 ? commands : [undefined]) {
      items.push({ kind: 'hook', name: event, ...(command ? { detail: command } : {}), file })
    }
  }
  for (const [name, server] of Object.entries(asRecord(settings.mcpServers) ?? {})) {
    items.push({ kind: 'mcp-server', name, ...serverDetail(server), file })
  }
  for (const key of MCP_SWITCH_KEYS) {
    if (settings[key] === true || (Array.isArray(settings[key]) && settings[key].length > 0)) {
      items.push({ kind: 'mcp-server', name: key, file })
    }
  }
  for (const key of COMMAND_KEYS) {
    const command = detail(settings[key])
    if (command) {
      items.push({ kind: 'command', name: key, detail: command, file })
    }
  }
  const statusLine = detail(asRecord(settings.statusLine)?.command)
  if (statusLine) {
    items.push({ kind: 'command', name: 'statusLine', detail: statusLine, file })
  }
  for (const name of Object.keys(asRecord(settings.env) ?? {})) {
    items.push({ kind: 'environment', name, file })
  }
  const permissions = asRecord(settings.permissions)
  const allowed = Array.isArray(permissions?.allow) ? permissions.allow.length : 0
  if (allowed > 0 || typeof permissions?.defaultMode === 'string') {
    const mode = detail(permissions?.defaultMode)
    items.push({
      kind: 'permissions',
      name: 'permissions',
      ...(mode ? { detail: mode } : {}),
      file
    })
  }
  for (const key of PLUGIN_KEYS) {
    if (Object.keys(asRecord(settings[key]) ?? {}).length > 0) {
      items.push({ kind: 'plugins', name: key, file })
    }
  }
  return items
}

function serverDetail(server: unknown): { detail?: string } {
  const record = asRecord(server)
  const command = detail(record?.command) ?? detail(record?.url)
  const args = Array.isArray(record?.args)
    ? record.args.filter((arg): arg is string => typeof arg === 'string').join(' ')
    : ''
  const text = detail([command, args].filter(Boolean).join(' '))
  return text ? { detail: text } : {}
}

/** A file that cannot be read as JSON is shown as itself: Claude may still read part of it. */
function parse(text: string): Record<string, unknown> | 'unreadable' {
  try {
    return asRecord(JSON.parse(text)) ?? 'unreadable'
  } catch {
    return 'unreadable'
  }
}

/** Null when the folder carries nothing that runs a command on its own. */
export function inspectAgentProjectConfig(directory: string): InspectedAgentProjectConfig | null {
  const hash = createHash('sha256')
  const items: AgentProjectConfigItem[] = []
  for (const file of [...SETTINGS_FILES, MCP_FILE]) {
    const text = readSmallFile(join(directory, file))
    if (text === null) {
      continue
    }
    hash.update(`${file}\0${text.length}\0${text}\0`)
    const parsed = text === '' ? 'unreadable' : parse(text)
    if (parsed === 'unreadable') {
      items.push({ kind: 'command', name: file, file })
    } else if (file === MCP_FILE) {
      for (const [name, server] of Object.entries(asRecord(parsed.mcpServers) ?? {})) {
        items.push({ kind: 'mcp-server', name, ...serverDetail(server), file })
      }
    } else {
      items.push(...settingsItems(file, parsed))
    }
  }
  return items.length > 0 ? { items, hash: hash.digest('hex') } : null
}
