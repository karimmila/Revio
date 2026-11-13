// @vitest-environment happy-dom

import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { Automation } from '../../../../shared/automations-types'
import {
  api,
  installAutomationsPageHarness,
  mocks,
  renderPage,
  scopedList,
  settleHostQueries
} from './automations-page-test-harness'
import { listedRow } from './automations-page-listed-items'
import { makeAutomation, REPO_ID, WORKSPACE_ID } from './automations-page-fixtures'
import { loadAutomationVersions } from './automation-version-history'

const ORIGINAL = makeAutomation({
  id: 'a-1',
  name: 'Nightly',
  workspaceMode: 'existing',
  workspaceId: WORKSPACE_ID,
  projectId: REPO_ID,
  updatedAt: 3
})

function desktopStoreHolds(automations: Automation[]): void {
  api.automations.list.mockResolvedValue(automations)
  scopedList(automations)
}

describe('AutomationsPage routine Duplicate and version history', () => {
  installAutomationsPageHarness()

  it('Duplicate opens a "Copy of" draft that saves through create', async () => {
    localStorage.clear()
    desktopStoreHolds([ORIGINAL])
    api.automations.create.mockResolvedValue(makeAutomation({ id: 'a-2', name: 'Copy of Nightly' }))
    await renderPage()
    await settleHostQueries()

    await act(async () => {
      mocks.listPanel?.duplicateAutomation?.(listedRow(ORIGINAL.id))
    })
    expect(mocks.editorDialog?.isEditing).toBe(false)
    expect(mocks.editorDialog?.draft).toMatchObject({
      name: 'Copy of Nightly',
      prompt: ORIGINAL.prompt,
      workspaceId: WORKSPACE_ID
    })
    await act(async () => {
      await mocks.editorDialog?.onSave()
    })
    await settleHostQueries()

    expect(api.automations.update).not.toHaveBeenCalled()
    expect(JSON.stringify(api.automations.create.mock.calls[0])).toContain('"Copy of Nightly"')
    expect(loadAutomationVersions('a-2').map((entry) => entry.snapshot.name)).toEqual([
      'Copy of Nightly'
    ])
  })

  it('an edit keeps the state before and after the save as versions', async () => {
    localStorage.clear()
    desktopStoreHolds([ORIGINAL])
    api.automations.update.mockResolvedValue({ ...ORIGINAL, name: 'Renamed', updatedAt: 9 })
    await renderPage()
    await settleHostQueries()

    await act(async () => {
      await mocks.listPanel?.openEditDialog(listedRow(ORIGINAL.id))
    })
    await act(async () => {
      mocks.editorDialog?.onDraftChange((current) =>
        typeof current === 'object' && current !== null ? { ...current, name: 'Renamed' } : current
      )
    })
    await act(async () => {
      await mocks.editorDialog?.onSave()
    })
    await settleHostQueries()

    expect(
      loadAutomationVersions(ORIGINAL.id).map((entry) => [entry.version, entry.snapshot.name])
    ).toEqual([
      [2, 'Renamed'],
      [1, 'Nightly']
    ])
  })
})
