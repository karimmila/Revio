import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_ORCA_SKILL_RENAMES_CAPABILITY } from '../../../shared/skill-install-capability'

const mocks = vi.hoisted(() => ({ supports: vi.fn(), rpc: vi.fn() }))
// This fork ships no renames yet (upstream's would claim Orca.app's folders); exercise the gate with one.
vi.mock('../../../shared/bundled-skill-renames.json', () => ({
  default: { 'revio-example': ['example'] }
}))
vi.mock('./runtime-rpc-client', () => ({
  runtimeEnvironmentSupportsCapability: mocks.supports,
  callRuntimeRpc: mocks.rpc
}))
import {
  autoUpdateBundledSkillsOnTarget,
  executeBundledSkillsOnTarget,
  planBundledSkillsOnTarget
} from './runtime-bundled-skills-client'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'

const target = { kind: 'environment', environmentId: 'paired-server' } as const
const request = { names: ['revio-example'] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('renamed skills on paired runtimes', () => {
  it('offers a server update before sending an unsupported canonical name', async () => {
    mocks.supports.mockImplementation(
      async (_id, capability) => capability !== BUNDLED_ORCA_SKILL_RENAMES_CAPABILITY
    )
    expect(await planBundledSkillsOnTarget(target, request)).toEqual({
      kind: 'unsupported',
      reason: 'update-server'
    })
    expect(await autoUpdateBundledSkillsOnTarget(target, request.names)).toBeNull()
    await expect(executeBundledSkillsOnTarget(target, 'digest', request)).rejects.toThrow(
      `Update ${FORK_PRODUCT_NAME} on the server`
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
