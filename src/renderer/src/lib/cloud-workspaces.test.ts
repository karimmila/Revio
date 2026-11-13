import { describe, expect, it } from 'vitest'
import { cloudRecipeGate, isCloudRepo } from './cloud-workspaces'

const recipes = [{ id: 'orca-cloud-vercel' }, { id: 'team-vm' }]

describe('cloud workspaces', () => {
  it('tells cloud repositories by the server their sandbox runs', () => {
    const cloud = new Set(['env-1'])
    expect(isCloudRepo({ executionHostId: 'runtime:env-1' }, cloud)).toBe(true)
    expect(isCloudRepo({ executionHostId: 'runtime:env-2' }, cloud)).toBe(false)
    expect(isCloudRepo({ executionHostId: 'local' }, cloud)).toBe(false)
  })

  it('offers only the cloud recipe in the Cloud location without the VM experiment', () => {
    const gate = cloudRecipeGate({ revioLayout: true, revioLocation: 'cloud' }, 'team-vm')
    expect(gate.enabled).toBe(true)
    expect(gate.initialRecipeId).toBe('orca-cloud-vercel')
    expect(gate.visible(recipes)).toEqual([{ id: 'orca-cloud-vercel' }])
  })

  it('leaves the Mac location as it was', () => {
    expect(cloudRecipeGate({ revioLayout: true, revioLocation: 'local' }, undefined)).toMatchObject(
      {
        enabled: false,
        initialRecipeId: undefined
      }
    )
    const experiment = cloudRecipeGate({ experimentalEphemeralVms: true }, 'team-vm')
    expect(experiment.initialRecipeId).toBe('team-vm')
    expect(experiment.visible(recipes)).toHaveLength(2)
  })
})
