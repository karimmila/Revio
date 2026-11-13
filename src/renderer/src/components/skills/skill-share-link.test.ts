import { describe, expect, it } from 'vitest'
import { FORK_IDENTITY } from '../../../../shared/fork-identity'
import { skillShareIdFromArguments } from '../../../../shared/skill-share-link'
import { parseSkillShareId } from './skill-share-link'

const SHARE_ON = {
  ...FORK_IDENTITY.services,
  shareBaseUrl: 'https://share.revio.example',
  skillShareUrl: 'https://app.revio.example'
}

describe('parseSkillShareId', () => {
  it('accepts nothing when this build has no share service', () => {
    expect(parseSkillShareId('share_123')).toBeNull()
    expect(parseSkillShareId('orca://skills/share/share_123')).toBeNull()
    expect(parseSkillShareId('https://app.orca.dev/skills/share/share_123')).toBeNull()
    expect(skillShareIdFromArguments(['revio', 'https://app.orca.dev/skills/share/a'])).toBeNull()
  })

  it('accepts links on the fork share hosts and bare identifiers', () => {
    expect(parseSkillShareId('share_123', SHARE_ON)).toBe('share_123')
    expect(parseSkillShareId('https://app.revio.example/skills/share/share_123', SHARE_ON)).toBe(
      'share_123'
    )
    expect(parseSkillShareId('https://share.revio.example/skills/share/share_123/', SHARE_ON)).toBe(
      'share_123'
    )
    expect(parseSkillShareId('orca://skills/share/share_123', SHARE_ON)).toBe('share_123')
  })

  it('rejects upstream hosts, attacker origins and lookalike paths', () => {
    expect(parseSkillShareId('https://app.orca.dev/skills/share/share_123', SHARE_ON)).toBeNull()
    expect(parseSkillShareId('https://attacker.test/skills/share/share_123', SHARE_ON)).toBeNull()
    expect(
      parseSkillShareId('https://app.revio.example/skills/share/share_123/more', SHARE_ON)
    ).toBeNull()
    expect(parseSkillShareId('javascript:share_123', SHARE_ON)).toBeNull()
  })
})
