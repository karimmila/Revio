import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))

import { detectedPresetsToOffer } from './DetectedOpenInMenuItems'

const preset = (id: string, command: string) => ({ id, label: id, command })
const presets = [
  preset('vscode', 'code'),
  preset('zed', 'zed'),
  preset('ghostty', 'open -a "Ghostty"')
]

describe('detectedPresetsToOffer', () => {
  it('offers installed presets that are not in the list', () => {
    const offers = detectedPresetsToOffer(presets, new Set(['vscode', 'ghostty']), [
      { command: 'code' }
    ])
    expect(offers.map((p) => p.id)).toEqual(['ghostty'])
  })

  it('offers nothing when the list is full', () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ command: `app-${i}` }))
    expect(detectedPresetsToOffer(presets, new Set(['zed']), full)).toEqual([])
  })
})
