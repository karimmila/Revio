import { afterEach, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({ app: { isPackaged: false } }))
vi.mock('electron', () => electron)

import {
  isAgentStatusHooksAvailable,
  resetAgentStatusHooksAvailabilityForTest
} from '../../shared/agent-hook-listener/configuration/agent-status-hooks-availability'
import { isAgentStatusHooksEnabled } from '../../shared/agent-hook-listener/configuration/agent-status-hooks-setting'
import { leaveSharedAgentHooksAloneWhenInstalled } from './shared-agent-hooks-guard'

afterEach(resetAgentStatusHooksAvailabilityForTest)

it('a source build keeps managing agent status hooks', () => {
  electron.app.isPackaged = false
  leaveSharedAgentHooksAloneWhenInstalled()
  expect(isAgentStatusHooksAvailable()).toBe(true)
  expect(isAgentStatusHooksEnabled({ agentStatusHooksEnabled: true })).toBe(true)
})

it('an installed app reads the hooks as off, whatever the profile saved', () => {
  electron.app.isPackaged = true
  leaveSharedAgentHooksAloneWhenInstalled()
  expect(isAgentStatusHooksAvailable()).toBe(false)
  expect(isAgentStatusHooksEnabled({ agentStatusHooksEnabled: true })).toBe(false)
  expect(isAgentStatusHooksEnabled(undefined)).toBe(false)
})
