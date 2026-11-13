import { lstatSync, rmSync } from 'node:fs'
import { posix } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createRuntimeTransportMetadata,
  ensureRuntimeSocketDir,
  RUNTIME_SOCKET_NAME_REGEX,
  shortRuntimeSocketDir
} from './runtime-rpc-socket-metadata'

const UID = 4242
const created: string[] = []

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('runtime socket path', () => {
  it('keeps the socket in userData when the path fits', () => {
    const meta = createRuntimeTransportMetadata(
      '/Users/me/Library/Application Support/orca',
      7,
      'darwin',
      'rt',
      UID
    )
    expect(meta.endpoint).toBe('/Users/me/Library/Application Support/orca/o-7-rt.sock')
  })

  it('moves an overlong macOS path into a short per-user folder', () => {
    const deep = `/private/tmp/${'a'.repeat(80)}/fresh-dev`
    const meta = createRuntimeTransportMetadata(deep, 76768, 'darwin', 'ff63', UID)
    expect(new TextEncoder().encode(meta.endpoint).length).toBeLessThanOrEqual(104)
    expect(posix.dirname(meta.endpoint)).toBe(shortRuntimeSocketDir(deep, UID))
    // The orphan sweep matches the same name in either folder.
    expect(RUNTIME_SOCKET_NAME_REGEX.test(posix.basename(meta.endpoint))).toBe(true)
  })

  it('uses the Linux limit on Linux', () => {
    const almost = `/home/${'b'.repeat(88)}`
    expect(createRuntimeTransportMetadata(almost, 1, 'linux', 'rt', UID).endpoint).toBe(
      `${almost}/o-1-rt.sock`
    )
    expect(createRuntimeTransportMetadata(almost, 1, 'darwin', 'rt', UID).endpoint).not.toBe(
      `${almost}/o-1-rt.sock`
    )
  })

  it('gives each profile its own folder', () => {
    expect(shortRuntimeSocketDir('/a', UID)).not.toBe(shortRuntimeSocketDir('/b', UID))
  })

  it('creates the fallback folders private to this user', () => {
    const uid = process.getuid?.()
    if (uid === undefined) {
      return
    }
    const endpoint = posix.join(shortRuntimeSocketDir(`/test-${Date.now()}`, uid), 'o-1-rt.sock')
    created.push(posix.dirname(endpoint))
    ensureRuntimeSocketDir(endpoint, uid)
    const dir = lstatSync(posix.dirname(endpoint))
    expect(dir.isDirectory()).toBe(true)
    expect(dir.mode & 0o077).toBe(0)
    expect(dir.uid).toBe(uid)
  })

  it('leaves an in-userData endpoint alone', () => {
    expect(() => ensureRuntimeSocketDir('/Users/me/orca/o-1-rt.sock', 501)).not.toThrow()
  })
})
