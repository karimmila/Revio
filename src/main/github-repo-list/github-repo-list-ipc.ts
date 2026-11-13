import { ipcMain } from 'electron'
import { ghExecFileAsync } from '../git/command-runner/gh-exec-file'
import { parseGithubRepoList, type GithubRepoSummary } from '../../shared/github-repo-list'
import { githubCoverage } from '../cloud/cloud-github-access'
import { currentGithubAppConfig } from '../cloud/github-app-settings'
import { appReposElseGh, githubAppRepoSummaries } from './github-app-repo-list'

/** The signed-in gh user's repositories, most recently pushed first (gh's own order). */
async function listGhRepos(): Promise<GithubRepoSummary[]> {
  const { stdout } = await ghExecFileAsync(
    ['repo', 'list', '--limit', '100', '--json', 'nameWithOwner,url,isPrivate'],
    { idempotent: true }
  )
  return parseGithubRepoList(stdout)
}

/** Signed out, or GitHub unreachable: no rows, and the caller falls back to `gh`. */
async function listAppRepos(): Promise<GithubRepoSummary[]> {
  const config = currentGithubAppConfig()
  if (!config.configured) {
    return []
  }
  return githubAppRepoSummaries(await githubCoverage(), config.host)
}

export function registerGithubRepoListHandlers(): void {
  ipcMain.handle('githubRepos:list', () => appReposElseGh(listAppRepos, listGhRepos))
}
