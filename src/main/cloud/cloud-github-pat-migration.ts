import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cloudDataRoot } from './cloud-repo-store'

/**
 * Before the GitHub App, cloud workspaces used one fine-grained token per owner, sealed under
 * `<cloud>/github/<owner>.enc`. Those tokens are dropped on startup (Orca never sends them again)
 * and the person is told once to sign in with the app instead.
 */
function patDir(): string {
  return join(cloudDataRoot(), 'github')
}

function noticeFile(): string {
  return join(cloudDataRoot(), 'github-app-migrated')
}

export function migrateGithubPatFiles(): boolean {
  const dir = patDir()
  if (!existsSync(dir)) {
    return false
  }
  const hadTokens = readdirSync(dir).some((file) => file.endsWith('.enc'))
  rmSync(dir, { recursive: true, force: true })
  if (hadTokens) {
    writeFileSync(noticeFile(), '', { mode: 0o600 })
  }
  return hadTokens
}

export function githubMigrationNoticePending(): boolean {
  return existsSync(noticeFile())
}

export function dismissGithubMigrationNotice(): void {
  rmSync(noticeFile(), { force: true })
}
