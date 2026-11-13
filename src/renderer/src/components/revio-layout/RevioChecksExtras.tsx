import React from 'react'
import { forgeRepoTarget } from '@/lib/cloud-forge-repo'
import { toast } from 'sonner'
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  ExternalLink,
  LoaderCircle,
  RotateCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import type { PRCheckDetail } from '../../../../shared/github/check-types'
import type { PRDeployment } from '../../../../shared/github/deployment-types'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import { revioLayoutActive } from './revio-root-flags'
import { deploymentTone, failedCheckCount, type DeploymentTone } from './revio-checks-extras'

function toneLabel(tone: DeploymentTone): string {
  switch (tone) {
    case 'deployed':
      return translate('auto.components.revioLayout.checksExtras.deployed', 'Deployed')
    case 'deploying':
      return translate('auto.components.revioLayout.checksExtras.deploying', 'Deploying')
    case 'failed':
      return translate('auto.components.revioLayout.checksExtras.failed', 'Failed')
    case 'inactive':
      return translate('auto.components.revioLayout.checksExtras.inactive', 'Inactive')
    case 'pending':
      return translate('auto.components.revioLayout.checksExtras.pending', 'Pending')
  }
}

function ToneIcon({ tone }: { tone: DeploymentTone }): React.JSX.Element {
  if (tone === 'deployed') {
    return <CircleCheck className="size-3 text-status-success" />
  }
  if (tone === 'failed') {
    return <CircleX className="size-3 text-destructive" />
  }
  if (tone === 'deploying') {
    return <LoaderCircle className="size-3 animate-spin text-status-warning" />
  }
  return <CircleDashed className="size-3 text-muted-foreground" />
}

export function useDeployments(
  repo: Repo | null,
  pr: Pick<PRInfo, 'headSha' | 'prRepo'> | null
): PRDeployment[] {
  const [deployments, setDeployments] = React.useState<PRDeployment[]>([])
  const headSha = pr?.headSha
  const prRepo = pr?.prRepo ?? null
  React.useEffect(() => {
    if (!repo || !headSha) {
      setDeployments([])
      return
    }
    let live = true
    void window.api.gh
      .prDeployments({ ...forgeRepoTarget(repo), headSha, prRepo })
      .catch((): PRDeployment[] => [])
      .then((next) => {
        if (live) {
          setDeployments(next)
        }
      })
    return () => {
      live = false
    }
  }, [repo, headSha, prRepo])
  return deployments
}

function RerunFailedChecks({
  repo,
  pr,
  failed
}: {
  repo: Repo
  pr: PRInfo
  failed: number
}): React.JSX.Element {
  const [confirming, setConfirming] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const rerun = async (): Promise<void> => {
    setRunning(true)
    try {
      const result = await window.api.gh.rerunPRChecks({
        ...forgeRepoTarget(repo),
        prNumber: pr.number,
        headSha: pr.headSha,
        failedOnly: true,
        prRepo: pr.prRepo ?? null
      })
      if (result.ok) {
        toast.success(
          translate(
            'auto.components.revioLayout.checksExtras.rerunStarted',
            'Re-running failed checks'
          )
        )
      } else {
        toast.error(result.error)
      }
    } finally {
      setRunning(false)
      setConfirming(false)
    }
  }
  const title = translate(
    'auto.components.revioLayout.checksExtras.rerunFailed',
    'Re-run failed checks'
  )
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        data-revio-rerun-checks=""
        disabled={running}
        onClick={() => setConfirming(true)}
      >
        <RotateCw className="size-3" />
        {title}
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {translate(
                'auto.components.revioLayout.checksExtras.rerunConfirm',
                'Restart {{count}} failed checks on GitHub?',
                { count: failed, defaultValue_one: 'Restart {{count}} failed check on GitHub?' }
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              {translate('auto.components.revioLayout.checksExtras.cancel', 'Cancel')}
            </Button>
            <Button type="button" disabled={running} onClick={() => void rerun()}>
              {title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The parts of the Checks tab Orca's panel lacks: "Re-run failed checks" (after a confirm)
 * and the head commit's Deployments. Hidden outside the workspace layout.
 */
export function RevioChecksExtras({
  repo,
  pr,
  checks
}: {
  repo: Repo | null
  pr: PRInfo | null
  checks: readonly PRCheckDetail[]
}): React.JSX.Element | null {
  const deployments = useDeployments(revioLayoutActive() ? repo : null, pr)
  const failed = failedCheckCount(checks)
  if (!revioLayoutActive() || !repo || !pr) {
    return null
  }
  return (
    <div className="border-b border-border">
      {failed > 0 ? (
        <div className="flex justify-end px-2 py-1">
          <RerunFailedChecks repo={repo} pr={pr} failed={failed} />
        </div>
      ) : null}
      {deployments.length > 0 ? (
        <div className="px-3 pb-2">
          <div className="py-1.5 text-xs font-medium text-muted-foreground">
            {translate('auto.components.revioLayout.checksExtras.deployments', 'Deployments')}
          </div>
          {deployments.map((deployment) => {
            const tone = deploymentTone(deployment)
            const { url } = deployment
            return (
              <div key={deployment.id} className="flex h-6 items-center gap-2 text-[12px]">
                <ToneIcon tone={tone} />
                <span className="min-w-0 flex-1 truncate">{deployment.environment}</span>
                <span className="text-[11px] text-muted-foreground">{toneLabel(tone)}</span>
                {url ? (
                  <button
                    type="button"
                    aria-label={translate(
                      'auto.components.revioLayout.checksExtras.openExternally',
                      'Open externally'
                    )}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(event) => openAppHttpLink(url, { event })}
                  >
                    <ExternalLink className="size-3" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
