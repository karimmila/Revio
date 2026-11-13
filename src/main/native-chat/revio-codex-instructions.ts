import { codexInstructionArgs, type RevioInstructionSettings } from './revio-agent-instructions'
import { codexPersonalityArgs } from '../../shared/revio-agent-style'
import type { GlobalSettings } from '../../shared/global-settings-types'

/**
 * The agent-facing toggles for Codex chats ("Use GitHub stacked PRs", "General
 * preferences"): Claude gets them as an appended system prompt; Codex reads them as
 * `developer_instructions` from a `-c` config override (a TOML string).
 */
export function revioCodexInstructionArgs(
  agent: string,
  settings: RevioInstructionSettings & Partial<Pick<GlobalSettings, 'revioCodexPersonality'>>
): string[] {
  return agent === 'codex'
    ? [...codexInstructionArgs(settings), ...codexPersonalityArgs(settings)]
    : []
}
