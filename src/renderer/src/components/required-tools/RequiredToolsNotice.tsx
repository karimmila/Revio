import { AlertTriangle, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  requiredToolInstallCommand,
  requiredToolInstallPage,
  type RequiredTool
} from '../../../../shared/missing-tool-install'
import { missingRequiredTools, type RequiredToolsCheck } from './required-tools-check'

function toolCopy(tool: RequiredTool): { title: string; why: string } {
  if (tool === 'git') {
    return {
      title: translate('components.requiredTools.git.title', 'Git is not installed'),
      why: translate(
        'components.requiredTools.git.why',
        '{{productName}} needs Git to open projects and create workspaces. On a Mac it comes with the Xcode Command Line Tools.'
      )
    }
  }
  if (tool === 'gh') {
    return {
      title: translate('components.requiredTools.gh.title', 'GitHub CLI (gh) is not installed'),
      why: translate(
        'components.requiredTools.gh.why',
        '{{productName}} uses gh for pull requests, checks and issues. You do not need to run gh auth login: {{productName}} signs in for you.'
      )
    }
  }
  return {
    title: translate('components.requiredTools.claude.title', 'Claude Code is not installed'),
    why: translate(
      'components.requiredTools.claude.why',
      'Workspaces on this Mac run Claude Code. Install it, then sign in by running claude once.'
    )
  }
}

/**
 * One entry per missing command-line tool: what is missing, why it matters and the command that
 * installs it. Renders nothing when every tool is present or still being checked.
 */
export function RequiredToolsNotice({
  check,
  className
}: {
  check: RequiredToolsCheck
  className?: string
}): React.JSX.Element | null {
  const missing = missingRequiredTools(check.presence)
  if (missing.length === 0) {
    return null
  }
  const platform = window.api?.platform?.get?.().platform ?? ''
  return (
    <div
      role="status"
      data-required-tools-notice=""
      className={`rounded-lg border border-border bg-muted/30 p-3 text-[13px] ${className ?? ''}`}
    >
      <ul className="space-y-3">
        {missing.map((tool) => {
          const copy = toolCopy(tool)
          const command = requiredToolInstallCommand(tool, platform)
          return (
            <li key={tool} className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-foreground">{copy.title}</div>
                <div className="text-muted-foreground">{copy.why}</div>
                {command ? (
                  <div className="text-muted-foreground">
                    {translate('components.requiredTools.runInTerminal', 'Run this in Terminal:')}{' '}
                    <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                      {command}
                    </code>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void window.api.shell.openUrl(requiredToolInstallPage(tool))}
                  >
                    {translate('components.requiredTools.installPage', 'Open the install page')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={check.checking}
          onClick={check.recheck}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] font-medium text-foreground hover:bg-accent disabled:opacity-60"
        >
          {check.checking ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          {translate('components.requiredTools.checkAgain', 'Check again')}
        </button>
      </div>
    </div>
  )
}
