// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ArchivedWorkspace } from '../../../../shared/revio-archive-types'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'

type MockState = {
  records: ArchivedWorkspace[]
  deletes: string[]
  finishDelete: (deleted: boolean) => void
  confirmCalls: string[]
  confirmBodies: string[]
}

const h = vi.hoisted((): MockState => ({
  records: [],
  deletes: [],
  finishDelete: () => {},
  confirmCalls: [],
  confirmBodies: []
}))

vi.mock('@/store', () => ({
  useAppStore: (select: (state: Record<string, unknown>) => unknown) =>
    select({ repos: [{ id: 'repo-1', displayName: 'app' }] })
}))
vi.mock('@/lib/revio-archive', () => ({
  onRevioArchiveChanged: () => () => {},
  unarchiveRevioWorkspace: async () => true,
  deleteArchivedWorkspace: (record: ArchivedWorkspace) => {
    h.deletes.push(record.id)
    return new Promise<boolean>((resolve) => {
      h.finishDelete = resolve
    })
  }
}))

import { RevioArchivedList } from './RevioArchivedList'

function record(id: string): ArchivedWorkspace {
  return {
    id,
    repoId: 'repo-1',
    displayName: id,
    branch: id,
    archiveCommit: 'abcdef1',
    archivedAt: 1,
    cloud: true,
    cloudRestore: { projectId: 'project-1', snapshotId: null }
  }
}

beforeEach(() => {
  h.records = [record('first'), record('second')]
  h.deletes = []
  h.confirmCalls = []
  h.confirmBodies = []
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { revioArchive: { list: async () => h.records } }
  })
})
afterEach(cleanup)

async function confirm(options: { title: string; description?: unknown }): Promise<boolean> {
  h.confirmCalls.push(options.title)
  h.confirmBodies.push(String(options.description))
  return true
}

async function renderList(cloud = true): Promise<void> {
  render(
    <ConfirmationDialogContext.Provider value={confirm}>
      <RevioArchivedList cloud={cloud} query="" showRepo={false} />
    </ConfirmationDialogContext.Provider>
  )
  await screen.findByText('first')
}

async function chooseDelete(name: string): Promise<void> {
  const trigger = screen.getByLabelText(`More actions for ${name}`)
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
}

it('asks once the menu has closed, and the row leaves as soon as the delete is confirmed', async () => {
  await renderList()
  await chooseDelete('first')
  await waitFor(() => expect(h.confirmCalls).toEqual(['Delete first?']))
  expect(screen.queryByRole('menu')).toBeNull()
  // Main has not finished deleting, yet the row is already gone and the next row's menu works.
  await waitFor(() => expect(screen.queryByText('first')).toBeNull())
  expect(h.deletes).toEqual(['first'])
  await chooseDelete('second')
  await waitFor(() => expect(h.confirmCalls).toHaveLength(2))
})

it('brings the row back when the delete fails', async () => {
  await renderList()
  await chooseDelete('first')
  await waitFor(() => expect(screen.queryByText('first')).toBeNull())
  await act(async () => h.finishDelete(false))
  expect(await screen.findByText('first')).toBeTruthy()
})

it('says a local workspace keeps its branch, and a cloud one its pushed commits', async () => {
  const { cloudRestore: _restore, ...local } = record('first')
  h.records = [{ ...local, cloud: false }]
  await renderList(false)
  await chooseDelete('first')
  await waitFor(() => expect(h.confirmBodies).toHaveLength(1))
  expect(h.confirmBodies[0]).toContain('The branch stays in your repository.')
  cleanup()

  h.records = [record('first')]
  await renderList()
  await chooseDelete('first')
  await waitFor(() => expect(h.confirmBodies).toHaveLength(2))
  expect(h.confirmBodies[1]).toContain('Pushed commits stay on GitHub.')
  expect(h.confirmBodies[1]).not.toContain('branch stays')
})
