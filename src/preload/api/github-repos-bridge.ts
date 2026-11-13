import { ipcRenderer } from 'electron'
import type { GithubRepoSummary } from '../../shared/github-repo-list'
import type { QuickStartRequest, QuickStartResult } from '../../shared/quick-start-types'

export type GithubReposApi = {
  /** Empty when gh is missing or signed out. */
  list: () => Promise<GithubRepoSummary[]>
  /** Toggles this window's developer tools (Help > Open debug tools). */
  toggleDevTools: () => Promise<void>
  /** Quick start on a new local repository: template, then an optional private GitHub repo. */
  quickStart: (request: QuickStartRequest) => Promise<QuickStartResult>
}

export const githubReposApi: GithubReposApi = {
  list: () => ipcRenderer.invoke('githubRepos:list'),
  toggleDevTools: () => ipcRenderer.invoke('revioApp:toggleDevTools'),
  quickStart: (request) => ipcRenderer.invoke('quickStart:apply', request)
}
