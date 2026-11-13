import type {
  WorkspaceImportDetection,
  WorkspaceImportPreparation,
  WorkspaceImportRepositoryScripts
} from '../../shared/workspace-import-types'
import {
  importSourceCloudMirrorDir,
  importSourceDataDir,
  openImportSourceSnapshot,
  type ImportSourceSnapshot
} from './import-source-database'
import { planWorkspaceImport, summarizeImportSource } from './workspace-import-plan'
import { readWorkspaceImportLedger } from './workspace-import-ledger'
import {
  importSourceScriptsHash,
  isRepositoryProvidedScripts,
  readImportSourceScripts
} from './workspace-import-scripts'

function withSnapshot<T>(fallback: T, read: (snapshot: ImportSourceSnapshot) => T): T {
  const dataDir = importSourceDataDir()
  const snapshot = dataDir ? openImportSourceSnapshot(dataDir, importSourceCloudMirrorDir()) : null
  if (!snapshot) {
    return fallback
  }
  try {
    return read(snapshot)
  } finally {
    snapshot.close()
  }
}

/**
 * Runs at first launch, before the person has chosen anything, so it reads the source app's own
 * data folder and nothing else. A repository, a workspace or a mirror can sit in a folder macOS
 * guards (Desktop, Documents, a volume); opening one here would raise a permission prompt for an
 * app the person has only just started. Those folders are first read by the import itself.
 */
export function detectWorkspaceImport(userDataDir: string): WorkspaceImportDetection {
  return withSnapshot<WorkspaceImportDetection>({ found: false }, (snapshot) => {
    if (snapshot.workspaces.length === 0) {
      return { found: false }
    }
    const ledger = readWorkspaceImportLedger(userDataDir)
    return { found: true, summary: summarizeImportSource(snapshot.workspaces, ledger) }
  })
}

/**
 * The step after the person presses Import: reads the scripts of the repositories the import will
 * add, so those a repository commits can be shown for approval before any is stored. A repository
 * that cannot be read brings no scripts; the import run reports it.
 */
export async function prepareWorkspaceImport(
  userDataDir: string
): Promise<WorkspaceImportPreparation> {
  const roots = withSnapshot(new Map<string, string>(), (snapshot) => {
    const ledger = readWorkspaceImportLedger(userDataDir)
    const found = new Map<string, string>()
    for (const { source, existingWorktreeId } of planWorkspaceImport(snapshot.workspaces, ledger, {
      includeArchived: false
    })) {
      if (source.repoRootPath && !existingWorktreeId) {
        found.set(source.repoRootPath, source.repoName)
      }
    }
    return found
  })
  const repositoryScripts: WorkspaceImportRepositoryScripts[] = []
  for (const [root, repoName] of roots) {
    const scripts = await readImportSourceScripts(root)
    if (scripts && (await isRepositoryProvidedScripts(root, scripts))) {
      repositoryScripts.push({
        repoName,
        setup: scripts.setup,
        run: scripts.run,
        hash: importSourceScriptsHash(scripts)
      })
    }
  }
  return { repositoryScripts }
}
