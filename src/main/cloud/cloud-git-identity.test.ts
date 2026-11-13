import { expect, it, vi } from 'vitest'

const proc = vi.hoisted(() => ({
  run: vi.fn(async ({ args }: { args: string[] }) => ({
    code: 0,
    stdout: args.at(-1) === 'user.name' ? 'Mac Name\n' : 'mac@example.com\n'
  }))
}))
vi.mock('@orca/process-host', () => ({ runProcess: proc.run }))
vi.mock('../ipc/command-path/command-path-resolver', () => ({
  resolveSelectedLocalCommand: () => 'git'
}))

import { cloudGitIdentity, setCloudGitIdentityOverride } from './vercel-workspace-io'

it("uses Settings' Git identity, falling back field by field to the Mac's git config", async () => {
  setCloudGitIdentityOverride(() => undefined)
  await expect(cloudGitIdentity('/repo')).resolves.toEqual({
    name: 'Mac Name',
    email: 'mac@example.com'
  })
  setCloudGitIdentityOverride(() => ({ name: 'Bot', email: ' ' }))
  await expect(cloudGitIdentity('/repo')).resolves.toEqual({
    name: 'Bot',
    email: 'mac@example.com'
  })
  setCloudGitIdentityOverride(() => ({ name: 'Bot', email: 'bot@example.com' }))
  await expect(cloudGitIdentity('/repo')).resolves.toEqual({
    name: 'Bot',
    email: 'bot@example.com'
  })
})
