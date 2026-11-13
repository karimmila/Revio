import { describe, expect, it } from 'vitest'
import { scrollbackChoices, withAgentCommandOverride } from './revio-advanced-values'

describe('Advanced values', () => {
  it('stores a trimmed path and drops an emptied one', () => {
    expect(withAgentCommandOverride({}, 'claude', '  /opt/claude ')).toEqual({
      claude: '/opt/claude'
    })
    expect(withAgentCommandOverride({ claude: '/opt/claude', codex: 'x' }, 'claude', ' ')).toEqual({
      codex: 'x'
    })
  })

  it('keeps a custom scrollback count among the presets', () => {
    expect(scrollbackChoices([5000, 10000], 10000)).toEqual([5000, 10000])
    expect(scrollbackChoices([5000, 10000], 7000)).toEqual([5000, 7000, 10000])
  })
})
