import type { GitHubWorkItemDetails } from '../../../../../shared/github/work-item-types'

/** Past this many files the list stops and says how many it left out. */
const LISTED_FILES = 50

const STATUS_WORDS: Record<GitHubWorkItemDetails['item']['state'], string> = {
  open: 'Open',
  draft: 'Draft',
  closed: 'Closed',
  merged: 'Merged'
}

function diffSummary(details: GitHubWorkItemDetails): string[] {
  const files = details.files ?? []
  if (files.length === 0) {
    return details.filesUnavailable ? ['## Changed files', '', 'Could not read the file list.'] : []
  }
  const additions = files.reduce((sum, file) => sum + file.additions, 0)
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0)
  const listed = files.slice(0, LISTED_FILES).map((file) => {
    const renamed = file.oldPath && file.oldPath !== file.path ? ` (from ${file.oldPath})` : ''
    return `- ${file.path}${renamed}: ${file.status}, +${file.additions} -${file.deletions}`
  })
  const rest = files.length - listed.length
  return [
    '## Changed files',
    '',
    `${files.length} files, +${additions} -${deletions}`,
    '',
    ...listed,
    ...(rest > 0 ? [`- … and ${rest} more`] : [])
  ]
}

/** The PR context file: what the agent gets when `#` picks a PR or issue. The layout writes
 * the header lines; the description and (for a PR) the changed-file summary are ours, so the
 * agent need not look the item up before it starts. */
export function workItemContextDocument(details: GitHubWorkItemDetails): string {
  const { item } = details
  const isPr = item.type === 'pr'
  const kind = isPr ? 'Pull request' : 'Issue'
  const branch =
    isPr && item.branchName
      ? [`**Branch:** ${item.branchName}${item.baseRefName ? ` → ${item.baseRefName}` : ''}`]
      : []
  const body = details.body.trim()
  const diff = isPr ? diffSummary(details) : []
  return [
    `# ${kind} #${item.number}: ${item.title}`,
    '',
    `**GitHub URL:** ${item.url}`,
    `**Status:** ${STATUS_WORDS[item.state]}`,
    ...branch,
    ...(item.author ? [`**Author:** ${item.author}`] : []),
    '',
    '## Description',
    '',
    body || 'No description provided.',
    ...(diff.length > 0 ? ['', ...diff] : [])
  ].join('\n')
}
