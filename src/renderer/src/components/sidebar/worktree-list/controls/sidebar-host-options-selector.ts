import { shallow } from 'zustand/shallow'
import { persistedUIValuesEqual } from '../../../../../../shared/persisted-ui-equality'
import type { AppState } from '@/store/types'
import type { Repo } from '../../../../../../shared/repo-types'
import { selectWslHostsServing } from '../../use-wsl-hosts-enabled'
import {
  type SidebarHostOption,
  buildSidebarHostOptions,
  sidebarHostSemantics
} from './sidebar-host-options'

/** Rebuilds the host options only when an input changed, and keeps the old list when equal. */
export function createSidebarHostOptionsSelector() {
  let inputs: readonly unknown[] = []
  let result: SidebarHostOption[] = []
  return (
    state: AppState,
    repos: readonly Repo[],
    settings: AppState['settings'],
    hostLabelOverrides: Parameters<typeof buildSidebarHostOptions>[0]['hostLabelOverrides']
  ): SidebarHostOption[] => {
    const nextInputs = [
      repos,
      state.sshTargetLabels,
      state.sshConnectionStates,
      settings,
      state.runtimeStatusByEnvironmentId,
      state.runtimeEnvironments,
      hostLabelOverrides,
      state.wslHostStatuses,
      selectWslHostsServing(state),
      state.wslHostServerFiles === 'missing'
    ]
    if (shallow(inputs, nextInputs)) {
      return result
    }
    inputs = nextInputs
    const next = buildSidebarHostOptions({
      repos,
      sshTargetLabels: state.sshTargetLabels,
      sshConnectionStates: state.sshConnectionStates,
      settings,
      runtimeEnvironments: state.runtimeEnvironments,
      runtimeStatusByEnvironmentId: state.runtimeStatusByEnvironmentId,
      hostLabelOverrides,
      wslHostStatuses: state.wslHostStatuses,
      wslHostsEnabled: selectWslHostsServing(state),
      wslHostServerFilesMissing: state.wslHostServerFiles === 'missing'
    })
    if (!persistedUIValuesEqual(result.map(sidebarHostSemantics), next.map(sidebarHostSemantics))) {
      result = next
    }
    return result
  }
}
