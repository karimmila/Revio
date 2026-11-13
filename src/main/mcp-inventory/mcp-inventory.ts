import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { ipcMain } from 'electron'
import { z } from 'zod'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { McpAgent, McpServerEntry, McpServerSpec } from '../../shared/mcp-inventory-types'
import {
  mcpAddArgs,
  parseClaudeMcpServers,
  parseCodexMcpServers
} from '../../shared/mcp-inventory-parse'
import { resolveStructuredAgentCommand } from '../native-chat/structured-agent-command-resolution'

async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

function codexHome(settings: GlobalSettings): string {
  return (
    settings.agentDefaultEnv?.codex?.CODEX_HOME ??
    process.env.CODEX_HOME ??
    join(homedir(), '.codex')
  )
}

export async function listMcpServers(settings: GlobalSettings): Promise<McpServerEntry[]> {
  const [claude, codex] = await Promise.all([
    readOrEmpty(join(homedir(), '.claude.json')),
    readOrEmpty(join(codexHome(settings), 'config.toml'))
  ])
  return [...parseClaudeMcpServers(claude), ...parseCodexMcpServers(codex)]
}

/** Adds through the agent's own CLI, so each agent writes its config file its own way. */
export async function addMcpServer(
  settings: GlobalSettings,
  agent: McpAgent,
  spec: McpServerSpec
): Promise<void> {
  const { command, prefixArgs } = resolveStructuredAgentCommand(agent, settings)
  const result = await runProcess({
    program: command,
    args: [...prefixArgs, ...mcpAddArgs(agent, spec)],
    env: { ...process.env, ...settings.agentDefaultEnv?.[agent] },
    timeoutMs: 30_000
  })
  if (result.timedOut || result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim()
    throw new Error(
      result.timedOut
        ? `${command} mcp add timed out.`
        : `${command} mcp add exited with code ${result.code ?? 'unknown'}${detail ? `: ${detail}` : ''}`
    )
  }
}

const serverName = z.string().regex(/^[\w.-]+$/)
const optionalArgs = z.array(z.string()).optional()

const mcpAddRequestSchema = z.object({
  agent: z.enum(['claude', 'codex']),
  spec: z.discriminatedUnion('transport', [
    z.object({
      name: serverName,
      transport: z.literal('http'),
      url: z.string(),
      args: optionalArgs
    }),
    z.object({
      name: serverName,
      transport: z.literal('stdio'),
      command: z.string(),
      args: optionalArgs
    })
  ])
})

export function registerMcpInventoryHandlers(getSettings: () => GlobalSettings): void {
  ipcMain.handle('mcpInventory:list', () => listMcpServers(getSettings()))
  ipcMain.handle('mcpInventory:add', async (_event, agent: unknown, spec: unknown) => {
    const request = mcpAddRequestSchema.safeParse({ agent, spec })
    if (!request.success) {
      throw new Error('Invalid MCP server.')
    }
    await addMcpServer(getSettings(), request.data.agent, request.data.spec)
    return listMcpServers(getSettings())
  })
}
