import { describe, expect, it } from 'vitest'
import {
  decideLocationFocus,
  locationMembership,
  type RevioLocation,
  type LocationMembership
} from './revio-location-focus'

const MAC = 'mac-repo::/Users/k/orca/workspaces/app/fox'
const HOME_FOLDER = 'home-folder::/Users/k'
const CLOUD = 'cloud-repo::/vercel/app'
const ARCHIVED = 'mac-repo::/Users/k/orca/workspaces/app/old'

const facts = {
  repos: [
    { id: 'mac-repo', connectionId: null, executionHostId: 'local' as const },
    { id: 'home-folder', connectionId: null, executionHostId: 'local' as const },
    { id: 'cloud-repo', connectionId: null, executionHostId: 'runtime:env-1' as const }
  ],
  repoWorktrees: {
    'mac-repo': [
      { id: MAC, isArchived: false },
      { id: ARCHIVED, isArchived: true }
    ],
    'home-folder': [{ id: HOME_FOLDER, isArchived: false }],
    'cloud-repo': [{ id: CLOUD, isArchived: false }]
  },
  cloudEnvironmentIds: new Set(['env-1']),
  cloudEnvironmentIdsKnown: true
}

function membershipIn(location: RevioLocation): (id: string) => LocationMembership {
  return (id) => locationMembership(id, location, facts)
}

describe('locationMembership', () => {
  it('puts Mac workspaces (the "~" folder too) on the Mac and cloud ones in the cloud', () => {
    expect(membershipIn('cloud')(HOME_FOLDER)).toBe('no')
    expect(membershipIn('cloud')(MAC)).toBe('no')
    expect(membershipIn('cloud')(CLOUD)).toBe('yes')
    expect(membershipIn('local')(HOME_FOLDER)).toBe('yes')
    expect(membershipIn('local')(CLOUD)).toBe('no')
  })

  it('treats an archived workspace as gone, and unloaded data as unknown', () => {
    expect(membershipIn('local')(ARCHIVED)).toBe('no')
    expect(membershipIn('local')('missing::/x')).toBe('unknown')
    expect(locationMembership(CLOUD, 'cloud', { ...facts, cloudEnvironmentIdsKnown: false })).toBe(
      'unknown'
    )
  })
})

describe('decideLocationFocus', () => {
  it('switching to the cloud leaves a Mac workspace for the last cloud one, else Home', () => {
    const toCloud = {
      activeWorktreeId: HOME_FOLDER,
      switched: true,
      membership: membershipIn('cloud')
    }
    expect(decideLocationFocus({ ...toCloud, rememberedWorktreeId: CLOUD })).toEqual({
      kind: 'open',
      worktreeId: CLOUD
    })
    expect(decideLocationFocus({ ...toCloud, rememberedWorktreeId: null })).toEqual({
      kind: 'home'
    })
  })

  it('switching from Home opens the location’s last workspace', () => {
    expect(
      decideLocationFocus({
        activeWorktreeId: null,
        rememberedWorktreeId: MAC,
        switched: true,
        membership: membershipIn('local')
      })
    ).toEqual({ kind: 'open', worktreeId: MAC })
  })

  it('an archived open workspace falls back to the last used one, else Home', () => {
    const base = { activeWorktreeId: ARCHIVED, switched: false, membership: membershipIn('local') }
    expect(decideLocationFocus({ ...base, rememberedWorktreeId: MAC })).toEqual({
      kind: 'open',
      worktreeId: MAC
    })
    expect(decideLocationFocus({ ...base, rememberedWorktreeId: ARCHIVED })).toEqual({
      kind: 'home'
    })
  })

  it('keeps a workspace that belongs, and a Home the person chose', () => {
    expect(
      decideLocationFocus({
        activeWorktreeId: CLOUD,
        rememberedWorktreeId: null,
        switched: true,
        membership: membershipIn('cloud')
      })
    ).toEqual({ kind: 'keep' })
    expect(
      decideLocationFocus({
        activeWorktreeId: null,
        rememberedWorktreeId: MAC,
        switched: false,
        membership: membershipIn('local')
      })
    ).toEqual({ kind: 'keep' })
  })

  it('waits while it cannot tell where the open workspace belongs', () => {
    expect(
      decideLocationFocus({
        activeWorktreeId: CLOUD,
        rememberedWorktreeId: null,
        switched: true,
        membership: () => 'unknown'
      })
    ).toEqual({ kind: 'wait' })
  })
})
