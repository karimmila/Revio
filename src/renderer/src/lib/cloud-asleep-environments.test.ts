import { expect, it } from 'vitest'
import { asleepCloudEnvironmentIds } from './cloud-asleep-environments'

const runtime = (
  runtimeEnvironmentId: string | undefined,
  status: 'running' | 'suspended' | 'resume_failed' | 'cleaned',
  patch: { recipeId?: string; cleanupStatus?: 'not_started' | 'succeeded' } = {}
) => ({
  recipeId: patch.recipeId ?? 'orca-cloud-vercel',
  runtimeEnvironmentId,
  status,
  cleanupStatus: patch.cleanupStatus ?? ('not_started' as const)
})

it('lists the environments of stopped cloud sandboxes that can be resumed', () => {
  expect([
    ...asleepCloudEnvironmentIds([
      runtime('env-awake', 'running'),
      runtime('env-asleep', 'suspended'),
      runtime('env-resume-failed', 'resume_failed'),
      // Another recipe's VM is not a cloud workspace; an archived sandbox is gone, not asleep.
      runtime('env-other-recipe', 'suspended', { recipeId: 'my-vm' }),
      runtime('env-archived', 'suspended', { cleanupStatus: 'succeeded' }),
      runtime(undefined, 'suspended')
    ])
  ]).toEqual(['env-asleep', 'env-resume-failed'])
})
