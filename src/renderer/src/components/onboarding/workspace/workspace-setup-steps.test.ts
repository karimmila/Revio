import { describe, expect, it } from 'vitest'
import { EMPTY_WORKSPACE_SETUP_PROGRESS } from '../../../../../shared/workspace-setup'
import {
  firstOpenIndexFrom,
  isReopenedSetup,
  neighbourIndex,
  recordStep,
  resumeStepIndex,
  setupSummary,
  stepIdAt,
  statusesSettled,
  stepMark,
  type SetupStatuses
} from './workspace-setup-steps'

const none: SetupStatuses = {
  agent: 'not-connected',
  cloud: 'not-connected',
  project: 'not-connected',
  github: 'not-connected'
}

describe('moving between steps', () => {
  it('visits every step, GitHub included, for someone who works on this Mac only', () => {
    // Pull requests and checks in a local workspace use the same GitHub sign-in as the cloud.
    expect(neighbourIndex(2, 1)).toBe(3)
    expect(stepIdAt(3)).toBe('github')
    expect(neighbourIndex(3, 1)).toBe(4)
    expect(neighbourIndex(4, -1)).toBe(3)
  })

  it('stops at both ends', () => {
    expect(neighbourIndex(0, -1)).toBe(0)
    expect(neighbourIndex(4, 1)).toBe(4)
  })
})

describe('step marks', () => {
  it('marks a connected step done even when it was skipped before', () => {
    const progress = { lastCompletedStep: 0, skipped: ['agent' as const] }
    expect(stepMark('agent', { ...none, agent: 'connected' }, progress)).toBe('done')
  })

  it('marks a skipped, still unconnected step as later', () => {
    const progress = { lastCompletedStep: 0, skipped: ['agent' as const] }
    expect(stepMark('agent', none, progress)).toBe('later')
    expect(stepMark('cloud', none, progress)).toBe('open')
  })
})

describe('skip and continue', () => {
  it('records Set up later and clears it on Continue', () => {
    const later = recordStep(EMPTY_WORKSPACE_SETUP_PROGRESS, 1, 'later')
    expect(later).toEqual({ lastCompletedStep: 1, skipped: ['cloud'] })
    expect(recordStep(later, 1, 'continue')).toEqual({ lastCompletedStep: 1, skipped: [] })
  })

  it('never moves saved progress back when an earlier step is revisited', () => {
    const progress = { lastCompletedStep: 3, skipped: [] }
    expect(recordStep(progress, 0, 'later')).toEqual({ lastCompletedStep: 3, skipped: ['agent'] })
  })

  it('never marks the final screen as later', () => {
    expect(recordStep(EMPTY_WORKSPACE_SETUP_PROGRESS, 4, 'later').skipped).toEqual([])
  })
})

describe('resume and auto-done', () => {
  it('starts a fresh flow at the first step that is not connected', () => {
    const statuses = { ...none, agent: 'connected' as const, cloud: 'connected' as const }
    expect(resumeStepIndex(EMPTY_WORKSPACE_SETUP_PROGRESS, statuses)).toBe(2)
  })

  it('resumes after the saved step', () => {
    expect(resumeStepIndex({ lastCompletedStep: 1, skipped: [] }, none)).toBe(2)
  })

  it('lands on the final screen when everything is connected', () => {
    const all: SetupStatuses = {
      agent: 'connected',
      cloud: 'connected',
      project: 'connected',
      github: 'connected'
    }
    expect(firstOpenIndexFrom(0, all)).toBe(4)
  })

  it('waits for every status before treating the flow as settled', () => {
    expect(statusesSettled({ ...none, github: 'checking' })).toBe(false)
    expect(statusesSettled(none)).toBe(true)
  })
})

describe('reopened from Help', () => {
  it('tells the reset record apart from a first run and from a resumed one', () => {
    expect(isReopenedSetup(EMPTY_WORKSPACE_SETUP_PROGRESS)).toBe(true)
    expect(isReopenedSetup(undefined)).toBe(false)
    expect(isReopenedSetup({ lastCompletedStep: 0, skipped: ['agent'] })).toBe(false)
  })
})

describe('final summary', () => {
  it('lists every step with its mark, GitHub included', () => {
    const progress = { lastCompletedStep: 3, skipped: ['cloud' as const] }
    expect(setupSummary({ ...none, agent: 'connected', project: 'connected' }, progress)).toEqual([
      { id: 'agent', mark: 'done' },
      { id: 'cloud', mark: 'later' },
      { id: 'project', mark: 'done' },
      { id: 'github', mark: 'open' }
    ])
  })
})
