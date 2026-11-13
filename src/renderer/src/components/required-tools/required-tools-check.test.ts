import { describe, expect, it } from 'vitest'
import { missingRequiredTools, UNKNOWN_REQUIRED_TOOLS } from './required-tools-check'

describe('missingRequiredTools', () => {
  it('reports nothing while the probes have not answered', () => {
    expect(missingRequiredTools(UNKNOWN_REQUIRED_TOOLS)).toEqual([])
  })

  it('names git and gh when the probe says they are absent', () => {
    expect(missingRequiredTools({ git: false, gh: false, claude: true, anyAgent: true })).toEqual([
      'git',
      'gh'
    ])
  })

  it('names Claude only when no agent CLI is installed at all', () => {
    expect(missingRequiredTools({ git: true, gh: true, claude: false, anyAgent: true })).toEqual([])
    expect(missingRequiredTools({ git: true, gh: true, claude: false, anyAgent: false })).toEqual([
      'claude'
    ])
  })
})
