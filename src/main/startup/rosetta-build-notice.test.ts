import { expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, dialog: {} }))
vi.mock('../i18n/main-i18n', () => ({ translateMain: (_key: string, text: string) => text }))

const { runsUnderRosetta } = await import('./rosetta-build-notice')

it('warns only for the Intel build translated on Apple silicon', () => {
  expect(runsUnderRosetta('darwin', true)).toBe(true)
  expect(runsUnderRosetta('darwin', false)).toBe(false)
  expect(runsUnderRosetta('linux', true)).toBe(false)
})
