import { z } from 'zod'
import type { McpServerEntry, McpServerSpec } from './mcp-inventory-types'

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

const claudeServerSchema = z.object({
  url: z.unknown().optional(),
  command: z.unknown().optional(),
  args: z.unknown().optional()
})
const claudeConfigSchema = z.object({ mcpServers: z.record(z.string(), z.unknown()) })

/** User-scope servers from `~/.claude.json` (`mcpServers`). */
export function parseClaudeMcpServers(json: string): McpServerEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }
  const config = claudeConfigSchema.safeParse(parsed)
  if (!config.success) {
    return []
  }
  return Object.entries(config.data.mcpServers).flatMap(([name, value]): McpServerEntry[] => {
    const server = claudeServerSchema.safeParse(value)
    if (!server.success) {
      return []
    }
    const { url, command } = server.data
    if (typeof url === 'string') {
      return [{ name, agent: 'claude', transport: 'http', url }]
    }
    if (typeof command === 'string') {
      return [
        {
          name,
          agent: 'claude',
          transport: 'stdio',
          command,
          args: stringArray(server.data.args)
        }
      ]
    }
    return []
  })
}

function tomlString(raw: string | undefined): string | undefined {
  const match = raw?.trim().match(/^"((?:[^"\\]|\\.)*)"$/)
  return match ? JSON.parse(`"${match[1]}"`) : undefined
}

function tomlStringArray(raw: string | undefined): string[] {
  const inner = raw?.trim().match(/^\[(.*)\]$/s)?.[1]
  return inner
    ? [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`))
    : []
}

/** `[mcp_servers.<name>]` tables from `~/.codex/config.toml`; nested tables such as `.env` are skipped. */
export function parseCodexMcpServers(toml: string): McpServerEntry[] {
  const entries: McpServerEntry[] = []
  let current: { name: string; keys: Record<string, string> } | null = null
  const flush = (): void => {
    if (!current) {
      return
    }
    const url = tomlString(current.keys.url)
    const command = tomlString(current.keys.command)
    if (url) {
      entries.push({ name: current.name, agent: 'codex', transport: 'http', url })
    } else if (command) {
      entries.push({
        name: current.name,
        agent: 'codex',
        transport: 'stdio',
        command,
        args: tomlStringArray(current.keys.args)
      })
    }
  }
  for (const line of toml.split('\n')) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/)
    if (header) {
      flush()
      const path = header[1]!.trim()
      const name = path.match(/^mcp_servers\.("?)([^".]+)\1$/)?.[2]
      current = name ? { name, keys: {} } : null
      continue
    }
    const pair = line.match(/^\s*([A-Za-z_]+)\s*=\s*(.+?)\s*$/)
    if (current && pair) {
      current.keys[pair[1]!] = pair[2]!
    }
  }
  flush()
  return entries
}

/** The CLI arguments that add a server to an agent at user scope. */
export function mcpAddArgs(agent: 'claude' | 'codex', spec: McpServerSpec): string[] {
  if (agent === 'claude') {
    return spec.transport === 'http'
      ? ['mcp', 'add', '--scope', 'user', '--transport', 'http', spec.name, spec.url ?? '']
      : ['mcp', 'add', '--scope', 'user', spec.name, '--', spec.command ?? '', ...(spec.args ?? [])]
  }
  return spec.transport === 'http'
    ? ['mcp', 'add', spec.name, '--url', spec.url ?? '']
    : ['mcp', 'add', spec.name, '--', spec.command ?? '', ...(spec.args ?? [])]
}
