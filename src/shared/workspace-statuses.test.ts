import { describe, expect, it } from 'vitest'
import {
  cloneDefaultWorkspaceStatuses,
  normalizePersistedWorkspaceStatuses,
  normalizeWorkspaceStatuses
} from './workspace-statuses'
import { LEGACY_NAME } from './legacy-name-migration'

describe('workspace status visuals', () => {
  it('normalizes every valid status without truncating the workflow', () => {
    const authored = Array.from({ length: 500 }, (_, index) => ({
      id: `state-${index}`,
      label: `State ${index}`
    }))

    expect(normalizeWorkspaceStatuses(authored).map((status) => status.id)).toEqual(
      authored.map((status) => status.id)
    )
  })

  it('migrates legacy default statuses to the default workflow order', () => {
    const statuses = normalizePersistedWorkspaceStatuses(
      [
        { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' },
        {
          id: 'in-progress',
          label: 'In progress',
          color: 'status-progress',
          icon: 'status-progress'
        },
        {
          id: 'in-review',
          label: 'In review',
          color: 'status-review',
          icon: 'status-review'
        },
        { id: 'completed', label: 'Completed', color: 'status-done', icon: 'status-done' }
      ],
      { migrateDefaultWorkflowStatuses: true }
    )

    expect(statuses).toEqual(cloneDefaultWorkspaceStatuses())
  })

  it('preserves explicit status order while migrating default visuals', () => {
    const statuses = normalizePersistedWorkspaceStatuses(
      [
        { id: 'completed', label: 'Completed', color: 'emerald', icon: 'circle-check' },
        { id: 'in-review', label: 'In review', color: 'violet', icon: 'git-pull-request' },
        { id: 'in-progress', label: 'In progress', color: 'blue', icon: 'circle-dot' },
        { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
      ],
      { migrateLegacyDefaultStatusVisuals: true }
    )

    expect(statuses.map((status) => status.id)).toEqual([
      'completed',
      'in-review',
      'in-progress',
      'todo'
    ])
    expect(statuses[0]).toMatchObject({
      color: 'status-done',
      icon: 'status-done'
    })
  })

  it('migrates exact reordered default statuses to the new Done label when requested', () => {
    const statuses = normalizePersistedWorkspaceStatuses(
      [
        { id: 'completed', label: 'Completed', color: 'status-done', icon: 'status-done' },
        {
          id: 'in-review',
          label: 'In review',
          color: 'status-review',
          icon: 'status-review'
        },
        {
          id: 'in-progress',
          label: 'In progress',
          color: 'status-progress',
          icon: 'status-progress'
        },
        { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
      ],
      { migrateDefaultWorkflowStatuses: true }
    )

    expect(statuses).toEqual(cloneDefaultWorkspaceStatuses())
  })

  it('repairs the exact PR-introduced default status reorder when migration-gated', () => {
    const statuses = normalizePersistedWorkspaceStatuses(
      [
        { id: 'completed', label: 'Completed', color: 'status-done', icon: 'status-done' },
        {
          id: 'in-review',
          label: 'In review',
          color: 'status-review',
          icon: 'status-review'
        },
        {
          id: 'in-progress',
          label: 'In progress',
          color: 'status-progress',
          icon: 'status-progress'
        },
        { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
      ],
      { repairReorderedDefaultStatuses: true }
    )

    expect(statuses).toEqual(cloneDefaultWorkspaceStatuses())
  })

  it('loads statuses saved with the legacy color and icon ids under the new ids', () => {
    const legacy = (rest: string): string => `${LEGACY_NAME}-${rest}`
    const custom = [
      { id: 'shipping', label: 'Shipping', color: legacy('done'), icon: legacy('progress') },
      { id: 'todo', label: 'Backlog', color: 'neutral', icon: 'circle' }
    ]
    const expected = [
      { id: 'shipping', label: 'Shipping', color: 'status-done', icon: 'status-progress' },
      { id: 'todo', label: 'Backlog', color: 'neutral', icon: 'circle' }
    ]
    expect(normalizeWorkspaceStatuses(custom)).toEqual(expected)
    expect(normalizePersistedWorkspaceStatuses(custom)).toEqual(expected)
    // The legacy-id spelling of the reordered default payload is still recognised and repaired.
    expect(
      normalizePersistedWorkspaceStatuses(
        [
          { id: 'completed', label: 'Completed', color: legacy('done'), icon: legacy('done') },
          { id: 'in-review', label: 'In review', color: legacy('review'), icon: legacy('review') },
          {
            id: 'in-progress',
            label: 'In progress',
            color: legacy('progress'),
            icon: legacy('progress')
          },
          { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
        ],
        { repairReorderedDefaultStatuses: true }
      )
    ).toEqual(cloneDefaultWorkspaceStatuses())
  })

  it('does not repair reordered default-label statuses with a different raw shape', () => {
    const statuses = normalizePersistedWorkspaceStatuses(
      [
        { id: 'completed', label: 'Completed', color: 'emerald', icon: 'circle-check' },
        { id: 'in-review', label: 'In review', color: 'violet', icon: 'git-pull-request' },
        { id: 'in-progress', label: 'In progress', color: 'blue', icon: 'circle-dot' },
        { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
      ],
      { repairReorderedDefaultStatuses: true }
    )

    expect(statuses.map((status) => status.id)).toEqual([
      'completed',
      'in-review',
      'in-progress',
      'todo'
    ])
  })

  it('preserves valid legacy visuals for default-label statuses at runtime', () => {
    const statuses = normalizeWorkspaceStatuses([
      { id: 'in-progress', label: 'In progress', color: 'blue', icon: 'circle-dot' }
    ])

    expect(statuses[0]).toMatchObject({
      color: 'blue',
      icon: 'circle-dot'
    })
  })

  it('truncates long labels without splitting an emoji surrogate pair', () => {
    const [status] = normalizeWorkspaceStatuses([
      { id: 'review', label: `${'a'.repeat(31)}🚀 later` }
    ])

    expect(status.label).toBe('a'.repeat(31))
  })
})
