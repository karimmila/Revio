import { describe, expect, it } from 'vitest'
import { dialogPrimaryIndex } from './revio-dialog-confirm'

describe('dialogPrimaryIndex', () => {
  it('picks the last enabled button that does not close the dialog', () => {
    expect(
      dialogPrimaryIndex([
        { disabled: false, closesDialog: true },
        { disabled: false, closesDialog: false }
      ])
    ).toBe(1)
    expect(
      dialogPrimaryIndex([
        { disabled: false, closesDialog: false },
        { disabled: true, closesDialog: false },
        { disabled: false, closesDialog: true }
      ])
    ).toBe(0)
    expect(dialogPrimaryIndex([{ disabled: false, closesDialog: true }])).toBe(-1)
  })
})
