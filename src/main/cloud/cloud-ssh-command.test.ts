import { describe, expect, it, vi } from 'vitest'

vi.mock('../ssh/targets/ssh-target-registry', () => ({ getSshTargetRegistryStore: () => null }))
vi.mock('../ssh/pinned-host-keys', () => ({
  pinnedKnownHostsFile: () =>
    '/Users/me/Library/Application Support/Orca/cloud-host-keys/r1.known_hosts'
}))

import { sshCommandLine } from './cloud-ssh-command'

describe('sshCommandLine', () => {
  it('quotes the proxy command and the pinned host file for a shell', () => {
    const line = sshCommandLine({
      id: 't1',
      label: 'repo (cloud)',
      host: 'sb-1.sandbox',
      port: 22,
      username: 'ubuntu',
      identityFile: '/Users/me/keys/r1',
      identitiesOnly: true,
      proxyCommand: "/usr/bin/env node '/a b/wsproxy.mjs' 'wss://x'",
      owner: { type: 'on-demand-runtime', runtimeId: 'r1' }
    })
    expect(line).toContain("ssh -i /Users/me/keys/r1 -o 'IdentitiesOnly=yes'")
    expect(line).toContain(
      `'ProxyCommand=/usr/bin/env node '\\''/a b/wsproxy.mjs'\\'' '\\''wss://x'\\'''`
    )
    expect(line).toContain('Application Support/Orca/cloud-host-keys/r1.known_hosts')
    expect(line.endsWith('-- ubuntu@sb-1.sandbox')).toBe(true)
  })
})
