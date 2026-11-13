import { describe, expect, it, vi } from 'vitest'
import type { ExecutionHostRegistryEntry } from '../../../../../../shared/execution-host-registry'
import { PROJECT_HOST_SETUP_RUNTIME_CAPABILITY } from '../../../../../../shared/worktree-runtime-capabilities'
import { buildSetupHostOptions } from './repository-host-setup-options'
import { FORK_PRODUCT_NAME } from '../../../../../../shared/fork-identity'

vi.mock('@/i18n/i18n', async () => {
  const fork = await import('../../../../../../shared/fork-identity')
  return {
    translate: (_key: string, fallback: string) =>
      fallback.replaceAll('{{productName}}', fork.FORK_PRODUCT_NAME)
  }
})

function runtimeHost(
  overrides: Partial<ExecutionHostRegistryEntry> = {}
): ExecutionHostRegistryEntry {
  return {
    id: 'runtime:env-1',
    kind: 'runtime',
    label: `Remote ${FORK_PRODUCT_NAME}`,
    detail: `${FORK_PRODUCT_NAME} server`,
    health: 'available',
    ...overrides
  }
}

describe('buildSetupHostOptions', () => {
  it('disables runtime hosts while capabilities are unknown', () => {
    expect(
      buildSetupHostOptions({
        projectHostSetups: [],
        hostOptions: [runtimeHost()]
      })[0]
    ).toMatchObject({
      isAvailable: false,
      detail: 'Checking host capabilities'
    })
  })

  it('disables runtime hosts that cannot run workspaces with explicit host context', () => {
    expect(
      buildSetupHostOptions({
        projectHostSetups: [],
        hostOptions: [
          runtimeHost({
            capabilities: [PROJECT_HOST_SETUP_RUNTIME_CAPABILITY]
          })
        ]
      })[0]
    ).toMatchObject({
      isAvailable: false,
      detail: `Update ${FORK_PRODUCT_NAME} on this host to set up projects`
    })
  })
})
