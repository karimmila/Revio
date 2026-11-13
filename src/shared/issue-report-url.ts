import { FORK_PRODUCT_NAME } from './fork-identity'

export type IssueReportEnvironment = {
  appVersion: string
  platform: string
  /** The OS version, e.g. "14.5"; empty when unknown. */
  osVersion: string
  arch: string
}

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

// Version strings only: a stray path or name in one of them must never reach the issue tracker.
function versionText(value: string): string {
  return /^[\w.+-]{1,40}$/.test(value.trim()) ? value.trim() : 'unknown'
}

/** One line that says which build and OS the report is about. No paths, names or ids. */
export function issueReportEnvironmentLine(environment: IssueReportEnvironment): string {
  const os = PLATFORM_NAMES[environment.platform] ?? 'unknown OS'
  const osVersion = environment.osVersion ? ` ${versionText(environment.osVersion)}` : ''
  return `${FORK_PRODUCT_NAME} ${versionText(environment.appVersion)} · ${os}${osVersion} · ${versionText(environment.arch)}`
}

/**
 * The new-issue page with the body prefilled through the `body` query parameter. The browser
 * opens it and the person submits it: the app itself sends nothing.
 */
export function issueReportUrl(issuesUrl: string, environment: IssueReportEnvironment): string {
  const url = new URL(issuesUrl)
  const body = [
    '**What happened**',
    '',
    '',
    '**Steps to reproduce**',
    '',
    '',
    '---',
    issueReportEnvironmentLine(environment)
  ].join('\n')
  url.searchParams.set('body', body)
  return url.toString()
}
