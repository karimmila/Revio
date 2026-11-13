import { app, BrowserWindow, powerMonitor } from 'electron'
import { join } from 'node:path'
import { AgentAwakeService } from '../power/agent-awake-service'
import { normalizeComputerAwakeMode } from '../../shared/computer-awake-mode'
import { registerSystemResumeBroadcast } from '../power/system-resume-broadcast'
import { readDesktopAwayState } from '../notifications/desktop-away-state'
import {
  listCapableSharedControlSockets,
  startDesktopPresenceReporter
} from '../notifications/desktop-presence-reporter'
import { agentHookServer } from '../agent-hooks/server'
import { installHookStatusSessionTabsRepublish } from '../agent-hooks/hook-status-session-tabs-republish'
import { initTelemetry, track } from '../telemetry/client'
import { setCodexTrustGrantTelemetry } from '../codex/trust/grants/codex-trust-grant-telemetry'
import { initObservability, resolveObservabilityConsent } from '../observability'
import { installMainConsoleLogFile } from '../observability/main-console-log-file'
import { recordDurableCrashBreadcrumb } from '../crash-reporting/durable-crash-breadcrumb'
import { reportPreviousHangDetection } from '../hang-watchdog/previous-hang-detection'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { recoverPendingSkillTransactions } from '../skills/skill-transaction-startup-recovery'
import { initCohortClassifier } from '../telemetry/cohort-classifier'
import { initOnboardingCohortClassifier } from '../telemetry/onboarding-cohort-classifier'
import { StatsCollector } from '../stats/collector'
import { feedAgentSessionStats } from '../stats/agent-session-stats-feed'
import { ClaudeUsageStore } from '../claude-usage/store'
import { CodexUsageStore } from '../codex-usage/store'
import { OpenCodeUsageStore } from '../opencode-usage/store'
import { MuseUsageStore } from '../muse-usage/store'
import { installRepoMaintenanceIdleGate } from '../workspaces/catalog/repo-maintenance-idle-gate'
import { installRevioRestartWhenIdle } from '../updater/revio-restart-when-idle'
import { isAppUpdaterEnabled } from '../../shared/update-feed'
import { installPrPollAttention } from '../github/install-pr-poll-attention'
import { getUpdateStatus, quitAndInstall } from '../updater/updater-service'
import { setPushAutoSetupRemotePolicy } from '../git/worktrees/creation/worktree-add'
import { setWorkspaceVariablesRoot } from '../workspace-variables/workspace-variables-files'
import { registerWorkspaceVariablesHandlers } from '../workspace-variables/workspace-variables-ipc'
import { setVercelCredentialsRoot } from '../vercel-cloud/vercel-cloud-credentials'
import { registerVercelCloudHandlers } from '../vercel-cloud/vercel-cloud-ipc'
import { registerAgentCredentialHandlers } from '../agent-credentials/agent-credentials-ipc'
import { registerMcpInventoryHandlers } from '../mcp-inventory/mcp-inventory'
import { registerGithubRepoListHandlers } from '../github-repo-list/github-repo-list-ipc'
import { registerAppDevToolsHandler } from '../github-repo-list/app-devtools-ipc'
import { followDebugToolsSetting } from './packaged-debug-switch-policy'
import { reclaimStaleWorktreeCreatePreparations } from '../workspaces/creation/preparation/worktree-create-preparation-project-removal'
import { registerAgentConfigSyncHandlers } from '../agent-config-sync/agent-config-sync'
import { registerQuickStartHandlers } from '../quick-start/quick-start'
import { setCloudDataRoot } from '../cloud/cloud-repo-store'
import { setCloudGitIdentityOverride } from '../cloud/vercel-workspace-io'
import { setPinnedRemoteLookup } from '../git/pinned-remote'
import { registerSetupStatusHandlers } from '../workspace-hooks/setup-status-ipc'
import { setEnvVarFilesLookup } from '../workspace-hooks/env-var-files'
import { registerCloudHandlers } from '../cloud/cloud-ipc'
import { registerRevioArchiveHandlers } from '../revio/revio-archive-ipc'
import { registerSupportHandlers } from '../menu/app-menu-help-items'
import {
  registerReleaseNoticeHandlers,
  startReleaseNoticeChecks
} from '../updater/release-notice/release-notice-service'
import { getLocalGitOptionsForRepo } from '../ipc/local-worktree-runtime-options'
import { registerBuiltinRecipeHandler } from '../../shared/ephemeral-vm-builtin-recipes'
import { VERCEL_SANDBOX_HANDLER } from '../../shared/cloud/cloud-recipe'
import {
  setCloudWorkspaceRepoResolver,
  vercelWorkspaceHandler
} from '../cloud/vercel-workspace-provider'
import { setCloudSshKeyPathReader } from '../cloud/cloud-ssh-access'
import { startCloudSessionWatch } from '../cloud/cloud-session-watch'
import { sweepPendingSandboxes } from '../cloud/cloud-pending-sandboxes'
import { bestEffort } from '../cloud/cloud-log'
import { setForgetImportedMirror } from '../cloud/cloud-mirror'
import { registerRepoActionsHandlers } from '../actions/repo-actions-ipc'
import { notifyReposChanged } from '../ipc/repos/repos-changed-notification'
import { repoFoldersFor } from '../workspace-variables/repo-folders'
import {
  findRepoForPath,
  setWorkspaceVariablesRepoResolver
} from '../workspace-variables/workspace-variables-env'
import { mainProcessState as state } from './main-process-state'
import { runAfterFirstWindowShown } from './first-window-deferral'

const TELEMETRY_CLIENT_START_FALLBACK_MS = 15_000
const RELEASE_NOTICE_START_FALLBACK_MS = 30_000

const STALE_PREPARATION_RECLAIM_DELAY_MS = 20_000

export function initializeMainProcessObservers(): void {
  const store = state.store
  if (!store) {
    throw new Error('Store must be initialized before observers')
  }
  state.unsubscribeSystemResumeBroadcast = registerSystemResumeBroadcast()
  state.stopDesktopPresenceReporter = startDesktopPresenceReporter({
    readAway: () => readDesktopAwayState(powerMonitor),
    listTargets: listCapableSharedControlSockets,
    subscribePowerEvents: ({ away, back }) => {
      powerMonitor.on('suspend', away)
      powerMonitor.on('lock-screen', away)
      powerMonitor.on('resume', back)
      powerMonitor.on('unlock-screen', back)
      return () => {
        powerMonitor.off('suspend', away)
        powerMonitor.off('lock-screen', away)
        powerMonitor.off('resume', back)
        powerMonitor.off('unlock-screen', back)
      }
    }
  })
  state.agentAwakeService = new AgentAwakeService()
  state.agentAwakeService.setMode(
    normalizeComputerAwakeMode(
      store.getSettings().computerAwakeMode,
      store.getSettings().keepComputerAwakeWhileAgentsRun
    )
  )
  // Hydrated rows preserve UI only; only this runtime's live hook events may keep the machine awake.
  state.agentAwakeService.setStatuses([])
  state.uninstallRepoMaintenanceIdleGate = installRepoMaintenanceIdleGate({
    isQuitting: () => state.isQuitting,
    getWorkingAgentCount: () => state.agentAwakeService?.getWorkingAgentCount() ?? 0
  })
  setWorkspaceVariablesRoot(() => join(app.getPath('userData'), 'env'))
  setWorkspaceVariablesRepoResolver((cwd) =>
    findRepoForPath(cwd, Object.keys(store.getAllWorktreeMeta()), store.getRepos())
  )
  registerWorkspaceVariablesHandlers((repoId) => repoFoldersFor(store, repoId))
  setVercelCredentialsRoot(() => app.getPath('userData'))
  registerVercelCloudHandlers()
  registerAgentCredentialHandlers(() => store.getSettings())
  registerMcpInventoryHandlers(() => store.getSettings())
  registerGithubRepoListHandlers()
  registerAppDevToolsHandler({
    isPackaged: () => app.isPackaged,
    debugToolsEnabled: () => store.getSettings().revioDebugTools === true
  })
  followDebugToolsSetting(store)
  // After startup has settled: prepared checkouts a killed quit or a crash left in the projects.
  setTimeout(
    () => reclaimStaleWorktreeCreatePreparations(store, store.getRepos()),
    STALE_PREPARATION_RECLAIM_DELAY_MS
  ).unref()
  registerAgentConfigSyncHandlers(() => store.getSettings())
  registerQuickStartHandlers()
  setCloudDataRoot(() => join(app.getPath('userData'), 'cloud'))
  registerCloudHandlers(() => store.getRepos())
  registerRevioArchiveHandlers((repoId) => {
    const repo = store.getRepos().find((candidate) => candidate.id === repoId)
    return repo ? { path: repo.path, options: getLocalGitOptionsForRepo(store, repo) } : null
  })
  registerRepoActionsHandlers(() => store.getRepos())
  registerReleaseNoticeHandlers()
  registerSupportHandlers()
  runAfterFirstWindowShown(startReleaseNoticeChecks, RELEASE_NOTICE_START_FALLBACK_MS)
  setCloudWorkspaceRepoResolver(
    (repoPath) => store.getRepos().find((repo) => repo.path === repoPath)?.id ?? null
  )
  setCloudSshKeyPathReader(() => store.getSettings().revioCloudSshKeyPath ?? '')
  registerBuiltinRecipeHandler(VERCEL_SANDBOX_HANDLER, vercelWorkspaceHandler)
  startCloudSessionWatch(
    () => app.getPath('userData'),
    () => store.getSettings().revioCloudIdleMinutes ?? 20
  )
  void sweepPendingSandboxes(app.getPath('userData')).catch(
    bestEffort('Sweeping sandboxes an earlier create left behind')
  )
  setForgetImportedMirror((repoId, mirrorPath) => {
    const repo = store.getRepos().find((candidate) => candidate.id === repoId)
    const imported = repo?.importedExternalWorktreePaths ?? []
    if (repo && imported.includes(mirrorPath)) {
      store.updateRepo(repo, {
        importedExternalWorktreePaths: imported.filter((path) => path !== mirrorPath)
      })
      notifyReposChanged(BrowserWindow.getAllWindows()[0] ?? null)
    }
  })
  setCloudGitIdentityOverride(() => store.getSettings().revioGitIdentity)
  registerSetupStatusHandlers()
  setEnvVarFilesLookup((repoId) => store.getSettings().revioEnvFiles?.[repoId] ?? [])
  setPinnedRemoteLookup(({ repoId, repoPath }) => {
    const pins = store.getSettings().revioRepoRemotes
    const id =
      repoId ?? store.getRepos().find((candidate) => candidate.path === repoPath)?.id ?? null
    return (id && pins?.[id]) || null
  })
  setPushAutoSetupRemotePolicy(() => {
    const settings = store.getSettings()
    return settings.revioLayout !== true || settings.revioSetUpstreamOnPush !== false
  })
  installPrPollAttention()
  installRevioRestartWhenIdle({
    isUpdaterEnabled: isAppUpdaterEnabled,
    getSettings: () => store.getSettings(),
    getUpdateState: () => getUpdateStatus().state,
    getWorkingAgentCount: () => state.agentAwakeService?.getWorkingAgentCount() ?? 0,
    getSystemIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    isQuitting: () => state.isQuitting,
    quitAndInstall
  })
  const unsubscribeStatusChanges = agentHookServer.subscribeStatusChanges((statuses) => {
    state.agentAwakeService?.setStatuses(statuses)
  })
  const unsubscribeStatusFreshness = agentHookServer.subscribeStatusFreshness((status) => {
    state.agentAwakeService?.observeStatusFreshness(status)
  })
  const uninstallHookStatusRepublish = installHookStatusSessionTabsRepublish(
    agentHookServer,
    () => state.runtime
  )
  state.unsubscribeAgentAwakeStatusChanges = () => {
    unsubscribeStatusChanges()
    unsubscribeStatusFreshness()
    uninstallHookStatusRepublish()
  }
  // Initialize before IPC/renderers can track; the telemetry client gates dev/disabled cases itself.
  // Load the SDK after first paint (#35752); headless serve and GPU failures never show a window.
  initTelemetry(store, (start) =>
    runAfterFirstWindowShown(start, TELEMETRY_CLIENT_START_FALLBACK_MS)
  )
  const profileStateStartup = state.profileStateStartup
  if (profileStateStartup) {
    track('profile_state_authority_selected', {
      backend: profileStateStartup.backend,
      classification: profileStateStartup.classification,
      authority_mode: 'sqlite-established',
      runtime: profileStateStartup.runtime,
      migrated: profileStateStartup.migrated
    })
  }
  // Inject tracking because plain-Node CLI imports cannot load the telemetry client.
  setCodexTrustGrantTelemetry(({ outcome, hostKind, lane, reason, errorClass, verifyClass }) => {
    track('codex_trust_grant', {
      outcome,
      host_kind: hostKind,
      lane,
      ...(reason !== undefined ? { fallback_reason: reason } : {}),
      ...(errorClass !== undefined ? { error_class: errorClass } : {}),
      ...(verifyClass !== undefined ? { verify_class: verifyClass } : {})
    })
  })
  // Initialize the independent error-tracking sink before any IPC/runtime span; it enforces diagnostics/privacy gates internally.
  initObservability()
  if (resolveObservabilityConsent().localFileEnabled) {
    installMainConsoleLogFile()
  }
  recordDurableCrashBreadcrumb('main_process_lifecycle_started', {
    packaged: app.isPackaged,
    platform: process.platform
  })
  state.hangDetection = reportPreviousHangDetection(getCanonicalUserDataPath())
  if (state.hangDetection) {
    track('main_thread_hang_detected', {
      unresponsive_ms: Math.round(state.hangDetection.unresponsiveMs),
      self_recovered: state.hangDetection.selfRecovered
    })
  }
  state.skillTransactionRecovery = recoverPendingSkillTransactions(
    join(app.getPath('userData'), 'skill-installs')
  )
  void state.skillTransactionRecovery
    .then((report) => {
      const result = report as {
        scanned: number
        recovered: number
        failures: { code: string }[]
        truncated: boolean
      }
      if (result.scanned || result.failures.length || result.truncated) {
        console.info('[skills] startup transaction recovery:', {
          scanned: result.scanned,
          recovered: result.recovered,
          failures: result.failures.map((failure) => failure.code),
          truncated: result.truncated
        })
      }
    })
    .catch((error) => console.warn('[skills] startup transaction recovery failed:', error))
  // Hydrate repo count before IPC/window tracking; cohort classification reads it synchronously.
  initCohortClassifier(store)
  initOnboardingCohortClassifier(store)
  state.stats = new StatsCollector()
  feedAgentSessionStats(state.stats, agentHookServer)
  state.claudeUsage = new ClaudeUsageStore(store)
  state.codexUsage = new CodexUsageStore(store)
  state.openCodeUsage = new OpenCodeUsageStore(store)
  state.museUsage = new MuseUsageStore(store)
}
