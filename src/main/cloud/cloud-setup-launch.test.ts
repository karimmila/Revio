import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ setupScript: 'pnpm dev' }))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => [
    { recipeId: 'orca-cloud-vercel', runtimeEnvironmentId: 'env-1', repoId: 'repo-1' }
  ]
}))
vi.mock('./cloud-repo-store', () => ({
  readRepoFile: () => ({ config: { setupScript: state.setupScript } })
}))
vi.mock('./vercel-workspace-provider', () => ({
  CLOUD_SETUP_SCRIPT_PATH: '/vercel/.orca-cloud-setup.sh'
}))

import { cloudSetupLaunchFor } from './cloud-setup-launch'

describe('cloudSetupLaunchFor', () => {
  it('runs the cloud setup script in the new workspace’s Setup tab', () => {
    expect(cloudSetupLaunchFor({ executionHostId: 'runtime:env-1' }, '/data')).toEqual({
      runnerScriptPath: '/vercel/.orca-cloud-setup.sh',
      envVars: {},
      command: 'bash /vercel/.orca-cloud-setup.sh'
    })
  })

  it('adds nothing for a Mac workspace or a repository without a setup script', () => {
    expect(cloudSetupLaunchFor({ executionHostId: 'local' }, '/data')).toBeUndefined()
    expect(cloudSetupLaunchFor({ executionHostId: 'runtime:other' }, '/data')).toBeUndefined()
    state.setupScript = '  '
    expect(cloudSetupLaunchFor({ executionHostId: 'runtime:env-1' }, '/data')).toBeUndefined()
  })
})
