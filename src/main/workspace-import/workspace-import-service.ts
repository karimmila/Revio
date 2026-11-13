import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'
import type { Repo } from '../../shared/repo-types'
import { agentSessionAccountHomePath } from '../../shared/agent-session/lifecycle/agent-session-account-home'
import type {
  ImportSourceChat,
  ImportSourceWorkspace,
  WorkspaceImportOptions,
  WorkspaceImportProgress,
  WorkspaceImportResult,
  WorkspaceImportSkip
} from '../../shared/workspace-import-types'
import { addLocalRepoFromPath } from '../ipc/repos/local-repo-registration'
import { notifyReposChanged } from '../ipc/repos/repos-changed-notification'
import { invalidateAuthorizedRootsCache } from '../ipc/worktrees/removal/registered-worktree-roots-cache'
import {
  importSourceCloudMirrorDir,
  importSourceDataDir,
  openImportSourceSnapshot
} from './import-source-database'
import { importSourceClaudeHome } from './import-source-transcripts'
import { chooseImportProject } from './workspace-import-project'
import { mostRecentSourceWorkspace, planWorkspaceImport } from './workspace-import-plan'
import { readWorkspaceImportLedger, writeWorkspaceImportLedger } from './workspace-import-ledger'
import { applyImportSourceScripts, approvedImportSourceScripts } from './workspace-import-scripts'
import {
  firstDeniedFolder,
  isExistingDirectory,
  isFolderAccessDenied
} from './workspace-import-folder-access'
import {
  placeImportedWorkspace,
  worktreeNameSeed,
  type WorkspaceImportContext
} from './workspace-import-worktree'
import {
  importChatWithTranscript,
  type ChatImportOutcome
} from './workspace-import-chat-transcript'
import {
  ASLEEP_CLOUD_LEDGER_PREFIX,
  addChatToAsleepCloudWorkspace,
  asleepCloudIdOfLedgerEntry,
  placeAsleepCloudWorkspace
} from './workspace-import-cloud-asleep'

export type WorkspaceImportServiceDeps = WorkspaceImportContext & { userDataDir: string }

type ImportProject = { repo: Repo; attach: boolean } | { denied: string } | null

/**
 * Every folder is read once without blocking before any other code opens it: macOS shows its
 * permission prompt on the first read of a guarded folder and holds that read until the person
 * answers, and only an asynchronous read leaves the app responsive meanwhile.
 */
async function projectFor(
  deps: WorkspaceImportServiceDeps,
  source: ImportSourceWorkspace
): Promise<ImportProject> {
  const sourceDenied = await firstDeniedFolder([source.repoRootPath, source.path])
  if (sourceDenied) {
    return { denied: sourceDenied }
  }
  const choice = await chooseImportProject(source, deps.store.getRepos(), deps.git)
  if (choice.kind === 'none') {
    return null
  }
  const projectPath = choice.kind === 'existing' ? choice.repo.path : choice.path
  const projectDenied = await firstDeniedFolder([projectPath])
  if (projectDenied) {
    return { denied: projectDenied }
  }
  if (choice.kind === 'existing') {
    return { repo: choice.repo, attach: choice.attachWorktree }
  }
  const added = await addLocalRepoFromPath(deps.store, choice.path)
  if ('error' in added) {
    return null
  }
  invalidateAuthorizedRootsCache()
  notifyReposChanged(deps.mainWindow)
  return { repo: added.repo, attach: choice.attachWorktree }
}

function worktreePathOf(worktreeId: string): string {
  return worktreeId.slice(getRepoIdFromWorktreeId(worktreeId).length + 2)
}

export async function runWorkspaceImport(
  deps: WorkspaceImportServiceDeps,
  options: WorkspaceImportOptions,
  onProgress: (progress: WorkspaceImportProgress) => void
): Promise<WorkspaceImportResult> {
  const dataDir = importSourceDataDir()
  const snapshot = dataDir ? openImportSourceSnapshot(dataDir, importSourceCloudMirrorDir()) : null
  const result: WorkspaceImportResult = {
    workspaces: 0,
    chats: 0,
    skipped: [],
    changesKeptAside: [],
    mostRecentWorktreeId: null
  }
  if (!snapshot) {
    return result
  }
  try {
    const ledger = readWorkspaceImportLedger(deps.userDataDir)
    const plan = planWorkspaceImport(snapshot.workspaces, ledger, options)
    const total = plan.reduce((sum, planned) => sum + 1 + planned.chats.length, 0)
    let done = 0
    const step = (): void => onProgress({ done: ++done, total })
    const skip = (entry: WorkspaceImportSkip): void => {
      result.skipped.push(entry)
    }
    const targetHome =
      agentSessionAccountHomePath(await deps.runtime.resolveStructuredAgentAccountHome('claude')) ??
      importSourceClaudeHome()
    const asleepChat = async (
      id: string,
      source: ImportSourceWorkspace,
      chat: ImportSourceChat
    ): Promise<ChatImportOutcome> => {
      const from = { snapshot, source, sourceHome: importSourceClaudeHome() }
      const kept = await addChatToAsleepCloudWorkspace(deps.userDataDir, id, from, chat)
      return kept.ok ? { ok: true, sessionId: kept.chat.providerSessionId } : kept
    }
    const scriptedRepos = new Set<string>()
    const approvedScripts = new Set(options.approvedScriptHashes ?? [])
    for (const planned of plan) {
      let { source } = planned
      let worktreeId = planned.existingWorktreeId
      let path = worktreeId ? worktreePathOf(worktreeId) : null
      if (!worktreeId) {
        const project = await projectFor(deps, source)
        if (!project || 'denied' in project) {
          skip(
            project
              ? { name: source.name, reason: 'folder-access-denied', folder: project.denied }
              : { name: source.name, reason: 'no-project' }
          )
          done += planned.chats.length
          step()
          continue
        }
        // Detection only named where a mirror would be; it is looked for now.
        if (source.mirrorPath && !(await isExistingDirectory(source.mirrorPath))) {
          source = { ...source, mirrorPath: null }
        }
        if (options.includeScripts && !scriptedRepos.has(project.repo.id)) {
          scriptedRepos.add(project.repo.id)
          const scripts = await approvedImportSourceScripts(source.repoRootPath, approvedScripts)
          if (scripts) {
            applyImportSourceScripts(deps.store, project.repo, scripts)
          }
        }
        try {
          // A cloud workspace stays in the cloud: asleep, with no sandbox until it is opened.
          const asleep =
            source.cloud && !project.attach
              ? await placeAsleepCloudWorkspace({
                  userDataDir: deps.userDataDir,
                  repo: project.repo,
                  source,
                  branch: source.branch ?? worktreeNameSeed(source)
                })
              : null
          if (asleep) {
            worktreeId = `${ASLEEP_CLOUD_LEDGER_PREFIX}${asleep.id}`
          } else {
            const placed = await placeImportedWorkspace(deps, project.repo, source, project.attach)
            worktreeId = placed.worktreeId
            path = placed.path
            if (placed.changes === 'kept-aside') {
              result.changesKeptAside.push(source.name)
            }
          }
        } catch (error) {
          skip(
            isFolderAccessDenied(error)
              ? { name: source.name, reason: 'folder-access-denied', folder: project.repo.path }
              : { name: source.name, reason: 'worktree-failed' }
          )
          done += planned.chats.length
          step()
          continue
        }
        ledger.workspaces[source.sourceId] = worktreeId
        writeWorkspaceImportLedger(deps.userDataDir, ledger)
        result.workspaces += 1
      }
      step()
      const asleepId = asleepCloudIdOfLedgerEntry(worktreeId)
      for (const chat of planned.chats) {
        const imported = asleepId
          ? await asleepChat(asleepId, source, chat)
          : await importChatWithTranscript({
              runtime: deps.runtime,
              snapshot,
              source,
              chat,
              worktreeId,
              worktreePath: path ?? source.path,
              sourceHome: importSourceClaudeHome(),
              targetHome
            })
        if (imported.ok) {
          ledger.chats[chat.sourceId] = imported.sessionId
          writeWorkspaceImportLedger(deps.userDataDir, ledger)
          result.chats += 1
        } else {
          skip({ name: chat.title || source.name, reason: imported.reason })
        }
        step()
      }
    }
    const newest = mostRecentSourceWorkspace(plan.map((planned) => planned.source))
    const newestId = newest ? (ledger.workspaces[newest.sourceId] ?? null) : null
    // An asleep cloud workspace has no worktree to open yet.
    result.mostRecentWorktreeId = asleepCloudIdOfLedgerEntry(newestId) ? null : newestId
    return result
  } finally {
    snapshot.close()
  }
}
