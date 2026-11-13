import { describe, expect, it } from 'vitest'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../../../shared/cloud/cloud-recipe'
import {
  cleanCloudSetupLog,
  cloudSetupProgressLabel,
  deriveCloudSetupSteps,
  isCloudSetupCreation,
  latestCloudSetupLogLine,
  parseCloudPhaseDurations,
  type CloudSetupEntry
} from './cloud-setup-steps'
import { getCreationProgressLabel } from './pending-worktree-creation'

const T0 = 1_000_000

const SANDBOX = 'Starting a sandbox from the build of 40b96a1\nSandbox orca-921f\n'
const MACHINE_DONE = '[cloud] create sandbox from snapshot: 2.2 s\n'
const SSH_DONE = 'SSH ready, host key pinned for orca-921f.sandbox\n[cloud] create ssh: 1.3 s\n'
const CHECKOUT_DONE = 'Checking out create-rotation-check\n[cloud] create checkout: 3.1 s\n'

function entry(overrides: Partial<CloudSetupEntry> = {}, recipeId = VERCEL_CLOUD_RECIPE_ID) {
  const base: CloudSetupEntry = {
    status: 'creating',
    phase: 'provisioning-vm',
    startedAt: T0,
    phaseLog: [{ phase: 'provisioning-vm', at: T0 }],
    provisioningLog: '',
    request: {
      repoId: 'repo',
      name: 'squid',
      setupDecision: 'inherit',
      agent: null,
      pendingFirstAgentMessageRename: false,
      note: '',
      startupPlan: null,
      quickPrompt: '',
      quickTelemetry: null,
      ephemeralVmRecipe: { sourceRepoId: 'repo', recipeId, projectId: 'p' }
    }
  }
  return { ...base, ...overrides }
}

function summary(e: CloudSetupEntry, now = T0 + 10_000): string[] {
  return deriveCloudSetupSteps(e, now).map(
    (step) => `${step.id}:${step.state}:${step.elapsedMs ?? '-'}`
  )
}

describe('parseCloudPhaseDurations', () => {
  it('reads the timing lines and ignores everything else', () => {
    const durations = parseCloudPhaseDurations(SANDBOX + MACHINE_DONE + SSH_DONE + CHECKOUT_DONE)
    expect([...durations]).toEqual([
      ['machine', 2200],
      ['connect', 1300],
      ['checkout', 3100]
    ])
  })

  it('ignores timing lines for phases it does not know', () => {
    expect(parseCloudPhaseDurations('[cloud] create warmup: 4.0 s\n').size).toBe(0)
  })
})

describe('deriveCloudSetupSteps (cloud create)', () => {
  it('starts with the machine running and the rest pending', () => {
    expect(summary(entry({ provisioningLog: SANDBOX }))).toEqual([
      'machine:running:10000',
      'connect:pending:-',
      'checkout:pending:-',
      'runtime:pending:-',
      'project:pending:-',
      'open:pending:-'
    ])
  })

  it('advances on each timing line and times the running step from the finished ones', () => {
    expect(summary(entry({ provisioningLog: SANDBOX + MACHINE_DONE }))).toEqual([
      'machine:done:2200',
      'connect:running:7800',
      'checkout:pending:-',
      'runtime:pending:-',
      'project:pending:-',
      'open:pending:-'
    ])
    expect(summary(entry({ provisioningLog: SANDBOX + MACHINE_DONE + SSH_DONE }))).toEqual([
      'machine:done:2200',
      'connect:done:1300',
      'checkout:running:6500',
      'runtime:pending:-',
      'project:pending:-',
      'open:pending:-'
    ])
  })

  it('opens the workspace once checkout finished, also after the provisioning phase ends', () => {
    const log = SANDBOX + MACHINE_DONE + SSH_DONE + CHECKOUT_DONE
    expect(summary(entry({ provisioningLog: log }))[3]).toBe('runtime:running:3400')
    const handedOver = entry({
      provisioningLog: log,
      phase: 'fetching',
      phaseLog: [
        { phase: 'provisioning-vm', at: T0 },
        { phase: 'fetching', at: T0 + 7000 }
      ]
    })
    expect(summary(handedOver).at(-1)).toBe('open:running:3400')
  })

  it('times the remote runtime and project steps that follow the checkout', () => {
    const log = `${SANDBOX}${MACHINE_DONE}${SSH_DONE}${CHECKOUT_DONE}[cloud] create remote runtime: 14.0 s\n[cloud] create project: 2.5 s\n`
    expect(summary(entry({ provisioningLog: log }), T0 + 30_000).slice(3)).toEqual([
      'runtime:done:14000',
      'project:done:2500',
      'open:running:6900'
    ])
  })

  it('adds a pending agent row when an agent will start', () => {
    const withAgent = entry()
    withAgent.request = { ...withAgent.request, agent: 'claude' }
    expect(summary(withAgent).at(-1)).toBe('start-agent:pending:-')
  })

  it('fails the step that was running and keeps later steps pending', () => {
    const failed = entry({
      status: 'error',
      provisioningLog: `${SANDBOX + MACHINE_DONE}SSH failed: connection refused\n`
    })
    expect(summary(failed)).toEqual([
      'machine:done:2200',
      'connect:failed:-',
      'checkout:pending:-',
      'runtime:pending:-',
      'project:pending:-',
      'open:pending:-'
    ])
  })

  it('fails the step the error names when its timing line never came', () => {
    const failed = entry({
      status: 'error',
      provisioningLog: SANDBOX,
      error: 'Git checkout failed: fatal: could not read from remote repository.'
    })
    expect(summary(failed)).toEqual([
      'machine:done:-',
      'connect:done:-',
      'checkout:failed:-',
      'runtime:pending:-',
      'project:pending:-',
      'open:pending:-'
    ])
  })

  it('never moves a failure earlier than the log already reached', () => {
    const failed = entry({
      status: 'error',
      provisioningLog: SANDBOX + MACHINE_DONE + SSH_DONE + CHECKOUT_DONE,
      error: 'ssh: connection reset'
    })
    expect(summary(failed)[3]).toBe('runtime:failed:-')
  })

  it('fails the machine step when the create fails before any output', () => {
    expect(summary(entry({ status: 'error', provisioningLog: '' }))[0]).toBe('machine:failed:-')
  })

  it('fails the open step when pairing or the workspace create fails after provisioning', () => {
    const failed = entry({
      status: 'error',
      phase: 'fetching',
      provisioningLog: SANDBOX + MACHINE_DONE + SSH_DONE + CHECKOUT_DONE
    })
    expect(summary(failed).at(-1)).toBe('open:failed:-')
  })

  it('restarts from the machine after a cancelled attempt is retried', () => {
    // Retry and continue reset the log and startedAt, which also restarts the phase log.
    const retried = entry({ startedAt: T0 + 60_000, phaseLog: [], provisioningLog: undefined })
    expect(summary(retried, T0 + 61_000)[0]).toBe('machine:running:1000')
  })

  it('treats the machine as reused when a retry skips provisioning', () => {
    const retried = entry({ phase: 'fetching', phaseLog: [{ phase: 'fetching', at: T0 }] })
    expect(summary(retried)).toEqual([
      'machine:done:-',
      'connect:done:-',
      'checkout:done:-',
      'runtime:done:-',
      'project:done:-',
      'open:running:10000'
    ])
  })
})

describe('deriveCloudSetupSteps (other VM recipes)', () => {
  it('shows one machine step timed by the phase log', () => {
    const running = entry({ provisioningLog: 'booting\n' }, 'custom-recipe')
    expect(summary(running)).toEqual(['machine:running:10000', 'open:pending:-'])
    const handedOver = entry(
      {
        phase: 'creating',
        phaseLog: [
          { phase: 'provisioning-vm', at: T0 },
          { phase: 'creating', at: T0 + 4000 }
        ]
      },
      'custom-recipe'
    )
    expect(summary(handedOver)).toEqual(['machine:done:4000', 'open:running:6000'])
  })
})

describe('progress labels', () => {
  it('names the current step in the sidebar instead of "Provisioning VM"', () => {
    const e = entry({ provisioningLog: SANDBOX + MACHINE_DONE + SSH_DONE })
    expect(cloudSetupProgressLabel(e, T0)).toBe('Checking out branch…')
    expect(
      getCreationProgressLabel({ ...e, indeterminate: false, checkoutProgress: undefined })
    ).toBe('Checking out branch…')
  })

  it('treats post-provisioning phases of a cloud request as cloud setup', () => {
    expect(isCloudSetupCreation(entry({ phase: 'fetching' }))).toBe(true)
    const local = entry({ phase: 'fetching' })
    local.request = { ...local.request, ephemeralVmRecipe: undefined }
    expect(isCloudSetupCreation(local)).toBe(false)
  })
})

describe('cleanCloudSetupLog', () => {
  it('drops the internal prefix only at line starts', () => {
    expect(cleanCloudSetupLog('[cloud] create ssh: 1.3 s\nkeep [cloud] here\n')).toBe(
      'create ssh: 1.3 s\nkeep [cloud] here\n'
    )
  })
})

describe('latestCloudSetupLogLine', () => {
  it('returns the newest line that is not a timing line, without the [cloud] prefix', () => {
    expect(
      latestCloudSetupLogLine(`${SANDBOX}${MACHINE_DONE}[cloud] Pairing the runtime\n\n`)
    ).toBe('Pairing the runtime')
    expect(latestCloudSetupLogLine(MACHINE_DONE)).toBeNull()
  })
})
