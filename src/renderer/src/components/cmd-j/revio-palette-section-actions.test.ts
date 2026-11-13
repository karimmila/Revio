import { expect, it, vi } from 'vitest'
import type { CmdJQuickAction } from './quick-actions'

const open = vi.hoisted(() => vi.fn())
const updateSettings = vi.hoisted(() => vi.fn())
const state = vi.hoisted(
  (): {
    activeWorktreeId: string | null
    updateSettings: typeof updateSettings
    settings: {
      revioSidebarSections: { id: string; name: string }[]
      revioWorkspaceSections: Record<string, string>
    }
  } => ({
    activeWorktreeId: 'r::/w',
    updateSettings,
    settings: {
      revioSidebarSections: [{ id: 's1', name: 'Review' }],
      revioWorkspaceSections: { 'r::/old': 's1' }
    }
  })
)
vi.mock('@/components/revio-layout/RevioSectionDialog', () => ({
  openRevioSectionDialog: open
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))

const { getRevioPaletteAppActions } = await import('./revio-palette-app-actions')
const ctx: Parameters<CmdJQuickAction['run']>[0] = Object.create(null)

it('lists existing sections before New section, and moves the workspace on screen', async () => {
  const actions = getRevioPaletteAppActions()
  const ids = actions.map((entry) => entry.id)
  expect(ids.indexOf('revio:move-to-section:s1')).toBeLessThan(ids.indexOf('revio:move-to-section'))
  await actions.find((entry) => entry.id === 'revio:move-to-section:s1')?.run(ctx)
  expect(updateSettings).toHaveBeenLastCalledWith({
    revioWorkspaceSections: { 'r::/old': 's1', 'r::/w': 's1' }
  })
  await actions.find((entry) => entry.id === 'revio:move-to-section')?.run(ctx)
  expect(open).toHaveBeenLastCalledWith({ moveWorktreeId: 'r::/w' })
  await actions.find((entry) => entry.id === 'revio:create-section')?.run(ctx)
  expect(open).toHaveBeenLastCalledWith({})
  state.activeWorktreeId = null
  expect(
    actions.find((entry) => entry.id === 'revio:move-to-section:s1')?.isAvailable(ctx)
  ).toMatchObject({ available: false })
})
