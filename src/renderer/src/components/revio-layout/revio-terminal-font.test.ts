import { describe, expect, it } from 'vitest'
import { effectiveTerminalFontSize } from './revio-terminal-font'

describe('effectiveTerminalFontSize', () => {
  it("scales the user's size to the terminal text in the workspace layout", () => {
    expect(effectiveTerminalFontSize({ terminalFontSize: 14, revioLayout: true })).toBe(11)
    expect(effectiveTerminalFontSize({ terminalFontSize: 18, revioLayout: true })).toBe(14)
  })

  it("keeps Orca's size outside the layout", () => {
    expect(effectiveTerminalFontSize({ terminalFontSize: 14, revioLayout: false })).toBe(14)
    expect(effectiveTerminalFontSize(null)).toBe(14)
  })
})
