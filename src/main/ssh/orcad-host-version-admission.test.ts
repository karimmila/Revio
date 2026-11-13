import { describe, expect, it } from 'vitest'
import packageJson from '../../../package.json'
import { emptyOrcadActivationRecord } from '../managed-server/activation/orcad-activation-record'
import {
  availableManagedOrcadUpdate,
  planManagedOrcadAutoUpdate
} from '../managed-server/lifecycle/orcad-managed-update-decision'
import { compareHostAppVersion, refuseOrcadHostDowngrade } from './orcad-host-version-admission'

/** A sandbox or host whose server was last started by a build from before the renumbering. */
const ranByEarlyBuild = {
  ...emptyOrcadActivationRecord(),
  active: '1.4.214+aaaa',
  activeAppVersion: '1.4.214'
}
const shipped = packageJson.version
const candidate = `${shipped}+bbbb`

describe('a host last run by a build from before the 0.x version line', () => {
  it('counts as older than the shipped version, though its number is higher', () => {
    expect(shipped.startsWith('0.')).toBe(true)
    expect(compareHostAppVersion('1.4.214', shipped)).toBeLessThan(0)
    expect(compareHostAppVersion(shipped, '1.4.214')).toBeGreaterThan(0)
  })

  it('is updated on connect instead of being refused as "newer than this app"', () => {
    expect(refuseOrcadHostDowngrade(ranByEarlyBuild, candidate, shipped)).toBeNull()
    expect(
      planManagedOrcadAutoUpdate({
        record: ranByEarlyBuild,
        candidateVersion: candidate,
        appVersion: shipped,
        failedBefore: false
      })
    ).toEqual({ action: 'update' })
    expect(
      availableManagedOrcadUpdate({
        record: ranByEarlyBuild,
        candidateVersion: candidate,
        appVersion: shipped,
        deferredCandidateVersion: null
      })
    ).toBe(candidate)
  })

  it('is not downgraded by an early build once the shipped version has run it', () => {
    const ranByShipped = {
      ...emptyOrcadActivationRecord(),
      active: candidate,
      activeAppVersion: shipped
    }
    expect(refuseOrcadHostDowngrade(ranByShipped, '1.4.214+aaaa', '1.4.214')).toBe('host-newer')
  })
})

describe('versions on one line', () => {
  it('order as before', () => {
    expect(compareHostAppVersion('0.2.0', '0.1.0')).toBeGreaterThan(0)
    expect(compareHostAppVersion('0.1.0', '0.1.0')).toBe(0)
    expect(compareHostAppVersion('1.4.240', '1.4.214')).toBeGreaterThan(0)
    expect(compareHostAppVersion('2.0.0', '1.5.0')).toBeGreaterThan(0)
    const newer = { ...emptyOrcadActivationRecord(), active: '0.2.0+cc', activeAppVersion: '0.2.0' }
    expect(refuseOrcadHostDowngrade(newer, '0.1.0+bb', '0.1.0')).toBe('host-newer')
  })
})
