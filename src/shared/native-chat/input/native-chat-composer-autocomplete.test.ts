import { describe, expect, it } from 'vitest'
import {
  applyMentionReplacement,
  deriveComposerAutocomplete,
  isSkillPickerTriggered
} from './native-chat-composer-autocomplete'
import type { SlashCommandSuggestion } from './native-chat-slash-commands'

import type { DiscoveredSkill } from '../../skills'
import { getNativeChatAgentProfile } from '../native-chat-agent-profiles'

const COMMANDS: SlashCommandSuggestion[] = [
  { name: 'clear' },
  { name: 'compact' },
  { name: 'help' }
]

function skill(overrides: Partial<DiscoveredSkill>): DiscoveredSkill {
  return {
    id: overrides.name ?? 'skill',
    name: 'typescript',
    description: null,
    providers: ['codex'],
    sourceKind: 'repo',
    sourceLabel: 'Repository',
    rootPath: '/repo/.agents/skills',
    directoryPath: '/repo/.agents/skills/typescript',
    skillFilePath: '/repo/.agents/skills/typescript/SKILL.md',
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

describe('deriveComposerAutocomplete — one grammar for every agent', () => {
  const skills = [
    skill({ name: 'typescript' }),
    skill({ name: 'react-useeffect', directoryPath: '/repo/.agents/skills/react-useeffect' })
  ]
  const codex = getNativeChatAgentProfile('codex')

  // `echo $HOME` + Enter once swapped `$HOME` for a skill whose description named $CODEX_HOME.
  it.each(['echo $HOME', 'costs $5', 'run $(pwd)'])('leaves shell `$` in %j as prose', (draft) => {
    expect(isSkillPickerTriggered(draft, codex)).toBe(false)
    expect(deriveComposerAutocomplete(draft, draft.length, COMMANDS, skills, codex).mode).toBe(
      'none'
    )
  })
})

describe('applyMentionReplacement', () => {
  it('swaps the open @ token for the given text and puts the caret after it', () => {
    const draft = 'look at @term and fix it'
    const caret = 'look at @term'.length
    const result = applyMentionReplacement(draft, caret, 'the output of terminal "Dev"')
    expect(result.draft).toBe('look at the output of terminal "Dev" and fix it')
    expect(result.draft.slice(0, result.caret)).toBe('look at the output of terminal "Dev" ')
  })

  it('leaves a draft with no open @ token alone', () => {
    expect(applyMentionReplacement('no token', 8, 'x')).toEqual({ draft: 'no token', caret: 8 })
  })
})
