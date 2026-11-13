import { describe, expect, it } from 'vitest'
import type { ManagedRuntimeInstallState } from '../../../../../shared/managed-runtime-install'
import {
  revioAcpInstallConfirmation,
  revioAcpInstalling,
  revioAcpInstallOutcome,
  revioManagedAcpAction,
  revioManagedAcpBadge,
  revioPathAcpBadge
} from './revio-acp-install'

const SHA = 'a'.repeat(64)
const URL = 'https://dl.google.com/agy-extensions/releases/macos/agy.zip'

function state(patch: Partial<ManagedRuntimeInstallState> = {}): ManagedRuntimeInstallState {
  return {
    agent: 'antigravity',
    revision: 1,
    available: true,
    version: '1.4.1',
    downloadBytes: 100,
    downloadUrl: URL,
    archiveSha256: SHA,
    installedVersion: null,
    installedCurrent: false,
    source: null,
    operation: null,
    ...patch
  }
}

const known = (patch: Partial<ManagedRuntimeInstallState> = {}) =>
  ({ kind: 'known', state: state(patch) }) as const

describe('revioManagedAcpBadge', () => {
  it('says Checking until the host answers', () => {
    expect(revioManagedAcpBadge(null)).toEqual({ kind: 'checking' })
    expect(revioManagedAcpBadge({ kind: 'unknown' })).toEqual({ kind: 'checking' })
  })

  it('names the installed version, Missing, Update required and Needs repair', () => {
    expect(
      revioManagedAcpBadge(known({ installedVersion: '1.4.1', installedCurrent: true }))
    ).toEqual({ kind: 'installed', version: '1.4.1' })
    expect(revioManagedAcpBadge(known())).toEqual({ kind: 'missing' })
    expect(revioManagedAcpBadge(known({ installedVersion: '1.3.0' }))).toEqual({
      kind: 'updateRequired'
    })
    expect(revioManagedAcpBadge(known({ damaged: true }))).toEqual({ kind: 'needsRepair' })
    expect(revioManagedAcpBadge({ kind: 'readFailed' })).toEqual({ kind: 'needsRepair' })
  })

  it('counts a copy found outside Orca as installed', () => {
    expect(revioManagedAcpBadge(known({ source: 'external' }))).toEqual({
      kind: 'installed',
      version: null
    })
  })
})

describe('revioManagedAcpAction', () => {
  it('offers Install for a missing or damaged copy', () => {
    expect(revioManagedAcpAction(state())).toBe('install')
    expect(revioManagedAcpAction(state({ damaged: true }))).toBe('install')
  })

  it('offers Update only when the installed copy is older than the pin', () => {
    expect(revioManagedAcpAction(state({ installedVersion: '1.3.9' }))).toBe('update')
    expect(revioManagedAcpAction(state({ installedVersion: '1.4.1' }))).toBe('update')
    expect(
      revioManagedAcpAction(state({ installedVersion: '1.4.1', installedCurrent: true }))
    ).toBeNull()
    expect(revioManagedAcpAction(state({ installedVersion: '1.5.0' }))).toBeNull()
  })

  it('offers nothing without a pin, beside an external copy, or while removing', () => {
    expect(revioManagedAcpAction(state({ available: false, version: null }))).toBeNull()
    expect(revioManagedAcpAction(state({ source: 'external' }))).toBeNull()
    const removing = {
      id: 'op',
      kind: 'remove',
      phase: 'removing',
      downloadedBytes: 0,
      totalBytes: null
    } as const
    expect(revioManagedAcpAction(state({ operation: removing }))).toBeNull()
  })
})

describe('revioAcpInstallConfirmation', () => {
  it('carries the pinned version, archive URL and sha256', () => {
    expect(revioAcpInstallConfirmation(state())).toEqual({
      version: '1.4.1',
      url: URL,
      archiveSha256: SHA
    })
  })

  it('is null when the host does not name the source', () => {
    expect(revioAcpInstallConfirmation(state({ downloadUrl: undefined }))).toBeNull()
    expect(revioAcpInstallConfirmation(state({ archiveSha256: undefined }))).toBeNull()
    expect(revioAcpInstallConfirmation(state({ available: false }))).toBeNull()
  })
})

describe('install progress and outcome', () => {
  const op = (phase: 'downloading' | 'succeeded' | 'failed', error?: string) => ({
    id: 'op-1',
    kind: 'install' as const,
    phase,
    downloadedBytes: 0,
    totalBytes: 100,
    ...(error === undefined ? {} : { error })
  })

  it('is installing while the host downloads, extracts or verifies', () => {
    expect(revioAcpInstalling(state({ operation: op('downloading') }))).toBe(true)
    expect(revioAcpInstalling(state({ operation: op('succeeded') }))).toBe(false)
  })

  it('reports only the end of the awaited operation', () => {
    expect(revioAcpInstallOutcome(state({ operation: op('succeeded') }), 'op-1')).toEqual({
      kind: 'succeeded'
    })
    expect(
      revioAcpInstallOutcome(state({ operation: op('failed', 'sha256 mismatch') }), 'op-1')
    ).toEqual({ kind: 'failed', error: 'sha256 mismatch' })
    expect(revioAcpInstallOutcome(state({ operation: op('downloading') }), 'op-1')).toBeNull()
    expect(revioAcpInstallOutcome(state({ operation: op('succeeded') }), 'other')).toBeNull()
    expect(revioAcpInstallOutcome(state({ operation: op('succeeded') }), null)).toBeNull()
  })
})

describe('revioPathAcpBadge', () => {
  it('reads PATH detection as Installed, Missing or Checking', () => {
    expect(revioPathAcpBadge(null, 'grok')).toEqual({ kind: 'checking' })
    expect(revioPathAcpBadge(['grok'], 'grok')).toEqual({ kind: 'installed', version: null })
    expect(revioPathAcpBadge(['omp'], 'grok')).toEqual({ kind: 'missing' })
  })
})
