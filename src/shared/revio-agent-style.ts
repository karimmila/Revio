// The Models rows "Codex personality" and "Claude output style" for new chats.

export const CODEX_PERSONALITIES = ['pragmatic', 'friendly', 'none'] as const
export type CodexPersonality = (typeof CODEX_PERSONALITIES)[number]

/** Claude Code's built-in output styles; "Default" applies none. */
export const CLAUDE_OUTPUT_STYLES = ['default', 'explanatory', 'learning'] as const
export type ClaudeOutputStyle = (typeof CLAUDE_OUTPUT_STYLES)[number]

const CLAUDE_OUTPUT_STYLE_NAMES: Record<Exclude<ClaudeOutputStyle, 'default'>, string> = {
  explanatory: 'Explanatory',
  learning: 'Learning'
}

type StyleSettings = {
  revioLayout?: boolean
  revioCodexPersonality?: CodexPersonality
  revioClaudeOutputStyle?: ClaudeOutputStyle
}

/** `-c personality="…"` for a Codex launch; none until a personality is chosen. */
export function codexPersonalityArgs(settings: StyleSettings): string[] {
  const personality = settings.revioCodexPersonality
  return settings.revioLayout === true &&
    personality &&
    CODEX_PERSONALITIES.some((value) => value === personality)
    ? ['-c', `personality=${JSON.stringify(personality)}`]
    : []
}

/** Claude Code's `--settings` JSON naming the output style; null for Default. */
export function claudeOutputStyleSettings(settings: StyleSettings): string | null {
  const style = settings.revioClaudeOutputStyle
  if (settings.revioLayout !== true || !style || style === 'default') {
    return null
  }
  const name = CLAUDE_OUTPUT_STYLE_NAMES[style]
  return name ? JSON.stringify({ outputStyle: name }) : null
}
