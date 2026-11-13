import { describe, expect, it } from 'vitest'
import { editWithAgentPrompt, workspaceArtifactPaths } from './revio-workspace-artifacts'

describe('workspaceArtifactPaths', () => {
  it('lists added or changed HTML pages once, skipping deletions', () => {
    expect(
      workspaceArtifactPaths(
        [
          { path: 'report.html', status: 'untracked', area: 'untracked' },
          { path: 'gone.html', status: 'deleted', area: 'unstaged' },
          { path: 'src/a.ts', status: 'modified', area: 'unstaged' }
        ],
        [
          { path: 'report.html', status: 'added' },
          { path: 'docs/chart.HTM', status: 'modified' }
        ]
      )
    ).toEqual(['docs/chart.HTM', 'report.html'])
  })

  it('drafts an edit prompt naming the page', () => {
    expect(editWithAgentPrompt('a.html')).toBe('Edit the artifact a.html: ')
  })
})
