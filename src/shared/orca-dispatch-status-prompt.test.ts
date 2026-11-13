import { describe, expect, it } from 'vitest'
import {
  findOrcaDispatchPreambleStart,
  ORCA_DISPATCH_PROMPT_LEAD_LINE,
  ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX
} from './orca-dispatch-status-prompt'

describe('findOrcaDispatchPreambleStart', () => {
  it('finds the current preamble after the typed lead line', () => {
    const prompt = `${ORCA_DISPATCH_PROMPT_LEAD_LINE}\n${ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX} rest`
    expect(findOrcaDispatchPreambleStart(prompt)).toBe(ORCA_DISPATCH_PROMPT_LEAD_LINE.length + 1)
  })

  it('still finds prompts written before the rename, which say Orca', () => {
    const lead =
      'Please carry out this task from my Orca coordinator by following the brief I pasted below.'
    const legacy = `${lead}\n<pasted_content id="x">\nYou are working inside Orca, a multi-agent IDE. rest`
    expect(findOrcaDispatchPreambleStart(legacy)).toBe(legacy.indexOf('You are working'))
    expect(findOrcaDispatchPreambleStart('You are working inside Orca, a multi-agent IDE.')).toBe(0)
  })

  it('rejects ordinary text', () => {
    expect(findOrcaDispatchPreambleStart('Fix the login bug')).toBe(-1)
  })
})
