// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { makeAutomation } from './automations-page-fixtures'
import { buildAutomationEditDraft } from './automation-edit-draft'
import {
  MAX_VERSIONS_PER_AUTOMATION,
  loadAutomationVersions,
  recordAutomationVersion,
  restoreAutomationVersionDraft
} from './automation-version-history'

describe('routine version history', () => {
  beforeEach(() => localStorage.clear())

  it('numbers saved versions, skips an unchanged save, and lists newest first', () => {
    recordAutomationVersion(makeAutomation({ name: 'One' }), 10)
    recordAutomationVersion(makeAutomation({ name: 'One' }), 11)
    recordAutomationVersion(makeAutomation({ name: 'Two' }), 20)
    const versions = loadAutomationVersions('a-1')
    expect(versions.map((entry) => [entry.version, entry.snapshot.name, entry.savedAt])).toEqual([
      [2, 'Two', 20],
      [1, 'One', 10]
    ])
    expect(loadAutomationVersions('other')).toEqual([])
  })

  it('keeps only the newest 20 versions of a routine', () => {
    for (let index = 1; index <= MAX_VERSIONS_PER_AUTOMATION + 5; index += 1) {
      recordAutomationVersion(makeAutomation({ prompt: `p${index}` }), index)
    }
    const versions = loadAutomationVersions('a-1')
    expect(versions).toHaveLength(MAX_VERSIONS_PER_AUTOMATION)
    expect(versions[0].version).toBe(25)
    expect(versions.at(-1)?.version).toBe(6)
  })

  it('drops stored entries that are not valid versions', () => {
    localStorage.setItem(
      'orca.automation-versions.v1',
      JSON.stringify({ 'a-1': [{ version: 1, savedAt: 1, snapshot: { name: 3 } }, 'x'] })
    )
    expect(loadAutomationVersions('a-1')).toEqual([])
    localStorage.setItem('orca.automation-versions.v1', '{not json')
    expect(loadAutomationVersions('a-1')).toEqual([])
  })

  it('restores a version into the editor and keeps the run location', () => {
    recordAutomationVersion(
      makeAutomation({
        name: 'Old',
        prompt: 'Old prompt',
        agentId: 'codex',
        rrule: 'FREQ=WEEKLY;BYDAY=WE;BYHOUR=7;BYMINUTE=30',
        precheck: { command: 'test -f x', timeoutSeconds: 5 },
        extraAgentArgs: '--fast'
      }),
      1
    )
    const [version] = loadAutomationVersions('a-1')
    const current = {
      ...buildAutomationEditDraft(makeAutomation()),
      projectId: 'repo-2',
      workspaceId: 'w-2'
    }
    expect(restoreAutomationVersionDraft(current, version)).toMatchObject({
      name: 'Old',
      prompt: 'Old prompt',
      agentId: 'codex',
      preset: 'weekly',
      time: '07:30',
      dayOfWeek: '3',
      precheckCommand: 'test -f x',
      precheckTimeoutSeconds: '5',
      extraAgentArgs: '--fast',
      projectId: 'repo-2',
      workspaceId: 'w-2'
    })
  })
})
