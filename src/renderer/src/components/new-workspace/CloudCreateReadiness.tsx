import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { cloudCreateBlock, githubSlugOfRepo } from '@/lib/cloud-create-guard'
import { useCloudReadiness } from '@/lib/cloud-readiness'
import type { CloudReadinessAction } from '../../../../shared/cloud/cloud-types'
import { openCloudSettings } from '@/components/revio-layout/RevioLocationSwitcher'

function openCloudFix(action: CloudReadinessAction, repoId: string | null): void {
  useAppStore.getState().closeModal()
  // GitHub sign-in and app installs live on Settings > Account; Vercel on Settings > Cloud.
  openCloudSettings(
    action === 'build' && repoId
      ? `repo:${repoId}`
      : action === 'connect-github'
        ? 'account'
        : 'cloud'
  )
}

function cloudActionLabel(action: CloudReadinessAction, owner: string): string {
  if (action === 'build') {
    return translate('auto.components.newWorkspace.CloudCreateReadiness.build', 'Build')
  }
  if (action === 'connect-github') {
    return translate(
      'auto.components.newWorkspace.CloudCreateReadiness.connectGithub',
      'Connect GitHub for {{value0}}',
      { value0: owner }
    )
  }
  return translate(
    'auto.components.newWorkspace.CloudCreateReadiness.connectVercel',
    'Connect Vercel'
  )
}

/**
 * Under the Cloud composer's header, only when Create is blocked: why, and the one step that
 * fixes it. Create refuses the same cases. A ready repository shows nothing.
 */
export function CloudCreateReadiness({ repoId }: { repoId: string }): React.JSX.Element | null {
  const repo = useAppStore((s) => s.repos.find((candidate) => candidate.id === repoId) ?? null)
  const readiness = useCloudReadiness(true)
  const block = cloudCreateBlock(repo, readiness)
  const slug = repo ? githubSlugOfRepo(repo) : null
  if (!block) {
    return null
  }
  return (
    <div
      className="flex items-center gap-2 px-3 pt-1 text-[12px] text-destructive"
      data-revio-cloud-blocked=""
    >
      <span className="min-w-0 flex-1">{block.reason}</span>
      {block.action ? (
        <button
          type="button"
          className="shrink-0 rounded-md border border-border px-2 py-0.5 text-foreground hover:bg-accent"
          onClick={() => block.action && openCloudFix(block.action, block.repoId)}
        >
          {cloudActionLabel(block.action, slug?.owner ?? '')}
        </button>
      ) : null}
    </div>
  )
}
