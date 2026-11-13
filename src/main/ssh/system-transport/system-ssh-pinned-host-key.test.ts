import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SshTarget } from '../../../shared/ssh-types'
import { appendSshTargetDestinationArgs } from './system-ssh-args'
import { pinHostKey, setPinnedHostKeyRootForTest } from '../pinned-host-keys'

const sandbox: SshTarget = {
  id: 'ssh-sandbox',
  label: 'Cloud workspace',
  owner: { type: 'on-demand-runtime', runtimeId: 'vercel-runtime-1' },
  host: 'green-aggregate-kite',
  port: 22,
  username: 'ubuntu',
  identityFile: '/keys/sandbox',
  identitiesOnly: true,
  proxyCommand: 'node bridge.mjs wss://sb.example.run',
  source: 'manual'
}

function optionValues(args: string[]): string[] {
  return args.flatMap((arg, index) => (args[index - 1] === '-o' ? [arg] : []))
}

describe('pinned host keys for cloud sandboxes', () => {
  const dirs: string[] = []
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  function useTempRoot(): void {
    const dir = mkdtempSync(join(tmpdir(), 'orca-pinned-'))
    dirs.push(dir)
    setPinnedHostKeyRootForTest(() => dir)
  }

  it('trusts only the pinned key, strictly, once Orca recorded one', () => {
    useTempRoot()
    const file = pinHostKey(
      'vercel-runtime-1',
      sandbox.host,
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA'
    )
    const args: string[] = []
    appendSshTargetDestinationArgs(args, sandbox)
    expect(optionValues(args)).toEqual(
      expect.arrayContaining([
        `UserKnownHostsFile="${file}"`,
        'GlobalKnownHostsFile=/dev/null',
        'StrictHostKeyChecking=yes'
      ])
    )
    // The pin must precede the destination, or OpenSSH reads it as a remote command.
    expect(args.indexOf(`UserKnownHostsFile="${file}"`)).toBeLessThan(args.indexOf('--'))
  })

  it('leaves hosts without a recorded key on the user known_hosts', () => {
    useTempRoot()
    const args: string[] = []
    appendSshTargetDestinationArgs(args, { ...sandbox, owner: undefined })
    appendSshTargetDestinationArgs(args, sandbox)
    expect(optionValues(args).some((value) => value.startsWith('UserKnownHostsFile='))).toBe(false)
  })

  it('writes one known_hosts line whatever the key text holds', () => {
    useTempRoot()
    const file = pinHostKey('r', 'host', 'ssh-ed25519 AAAA\nevil-host ssh-rsa BBBB')
    expect(readFileSync(file, 'utf8')).toBe('host ssh-ed25519 AAAA\n')
    expect(() => pinHostKey('r', 'host other', 'ssh-ed25519 AAAA')).toThrow()
    expect(() => pinHostKey('r', 'host', 'ssh-ed25519 not*base64')).toThrow()
  })
})
