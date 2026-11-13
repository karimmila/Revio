import React from 'react'
import { FileCode, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { joinPath } from '@/lib/path'
import { detectLanguage } from '@/lib/language-detect'
import { Button } from '@/components/ui/button'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type { GitBranchChangeEntry } from '../../../../shared/git/diff/git-diff-compare-types'
import { isForkServiceEnabled } from '../../../../shared/fork-services'
import { editWithAgentPrompt, workspaceArtifactPaths } from './revio-workspace-artifacts'
import { launchRevioAgentChat } from './launch-revio-chat'

const NO_STATUS: readonly GitStatusEntry[] = []
const NO_BRANCH: readonly GitBranchChangeEntry[] = []

/**
 * The Artifacts tab: the HTML pages this workspace made, with Open and "Edit with agent",
 * and a way to Orca's published artifacts (its stand-in for Team artifacts).
 */
export function RevioArtifactsPanel(): React.JSX.Element {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const worktreePath = useAppStore((s) =>
    s.activeWorktreeId
      ? (findWorktreeById(selectWorktreesByRepo(s), s.activeWorktreeId)?.path ?? null)
      : null
  )
  const statusEntries = useAppStore((s) =>
    worktreeId ? (s.gitStatusByWorktree?.[worktreeId] ?? NO_STATUS) : NO_STATUS
  )
  const branchEntries = useAppStore((s) =>
    worktreeId ? (s.gitBranchChangesByWorktree?.[worktreeId] ?? NO_BRANCH) : NO_BRANCH
  )
  const openFile = useAppStore((s) => s.openFile)
  const openArtifactsPage = useAppStore((s) => s.openArtifactsPage)
  const paths = React.useMemo(
    () => workspaceArtifactPaths(statusEntries, branchEntries),
    [statusEntries, branchEntries]
  )
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto scrollbar-sleek">
      <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
        {translate('auto.components.revioLayout.artifactsThisWorkspace', 'This workspace')}
      </div>
      {paths.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-muted-foreground">
          {translate(
            'auto.components.revioLayout.artifactsEmpty',
            'No artifacts yet. HTML pages the agent makes in this workspace show here.'
          )}
        </p>
      ) : (
        paths.map((path) => (
          <div key={path} className="group flex h-7 items-center gap-2 px-3 text-[12.5px]">
            <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left hover:underline"
              title={path}
              onClick={() => {
                if (worktreeId && worktreePath) {
                  openFile({
                    filePath: joinPath(worktreePath, path),
                    relativePath: path,
                    worktreeId,
                    language: detectLanguage(path),
                    mode: 'edit'
                  })
                }
              }}
            >
              {path}
            </button>
            <button
              type="button"
              className="shrink-0 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={() => {
                if (worktreeId) {
                  launchRevioAgentChat(worktreeId, {
                    prompt: editWithAgentPrompt(path),
                    draft: true
                  })
                }
              }}
            >
              {translate('auto.components.revioLayout.editWithAgent', 'Edit with agent')}
            </button>
          </div>
        ))
      )}
      {isForkServiceEnabled('shareBaseUrl') ? (
        <div className="mt-2 border-t border-border px-3 py-2">
          <Button type="button" variant="ghost" size="xs" onClick={openArtifactsPage}>
            <Sparkles className="size-3" />
            {translate('auto.components.revioLayout.publishedArtifacts', 'Published artifacts')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
