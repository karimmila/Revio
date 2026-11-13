import { expect, it, vi } from 'vitest'
import type * as ForkServicesModule from '../../../../shared/fork-services'
import type { ForkServices } from '../../../../shared/fork-identity'

type PaletteServices = Pick<ForkServices, 'feedbackUrl' | 'issuesUrl' | 'whatsNewUrl'>

const services = vi.hoisted((): PaletteServices => ({
  feedbackUrl: null,
  issuesUrl: null,
  whatsNewUrl: null
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ activeWorktreeId: null, settings: {} }) }
}))
vi.mock('../../../../shared/fork-services', async (importOriginal) => {
  const actual = await importOriginal<typeof ForkServicesModule>()
  const { FORK_IDENTITY } = await import('../../../../shared/fork-identity')
  const current = (): ForkServices => ({ ...FORK_IDENTITY.services, ...services })
  return {
    ...actual,
    forkServiceUrl: (name: ForkServicesModule.ForkServiceName) =>
      actual.forkServiceUrl(name, current()),
    forkServiceEndpoint: (name: ForkServicesModule.ForkServiceName, path: string) =>
      actual.forkServiceEndpoint(name, path, current())
  }
})

const { getRevioPaletteAppActions } = await import('./revio-palette-app-actions')
const ids = (): string[] => getRevioPaletteAppActions().map((entry) => entry.id)

it('hides changelog and feedback when this build names no service', () => {
  expect(ids()).not.toContain('revio:changelog')
  expect(ids()).not.toContain('revio:feedback')
})

it('offers Report an issue for a tracker and the changelog for a fork feed', () => {
  services.issuesUrl = 'https://github.com/example/app/issues/new'
  services.whatsNewUrl = 'https://example.com'
  const actions = getRevioPaletteAppActions()
  expect(actions.find((entry) => entry.id === 'revio:feedback')?.title).toBe('Report an issue')
  expect(actions.map((entry) => entry.id)).toContain('revio:changelog')
})
