import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { z } from 'zod'
import type { CloudGithubEvent, CloudGithubSignIn } from '../../shared/cloud/cloud-types'
import { githubAppInstallUrl } from '../../shared/cloud/github-app-config'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import type { Repo } from '../../shared/repo-types'
import { forgetGithubCoverage } from './cloud-github-access'
import { dismissGithubMigrationNotice, migrateGithubPatFiles } from './cloud-github-pat-migration'
import { isGithubOwner, readGithubStatus } from './cloud-github-status'
import { startDefaultGithubTokenKeeper } from './cloud-github-token-keeper'
import { bestEffort } from './cloud-log'
import {
  DeviceFlowError,
  pollDeviceToken,
  requestDeviceCode,
  type DeviceCode
} from './github-app-device-flow'
import { GITHUB_SIGN_IN_OFFLINE } from './github-app-oauth'
import { isNetworkFailure } from '../../shared/network-failure'
import {
  currentGithubAppConfig,
  readGithubAppOverride,
  writeGithubAppOverride
} from './github-app-settings'
import {
  KEYCHAIN_REFUSED,
  onGithubSessionChange,
  onSessionKeychainRefused,
  retrySessionUnseal,
  saveGithubSession,
  signOutGithub
} from './github-app-session'

export const CLOUD_GITHUB_EVENT = 'cloud:githubChanged'
// An install on GitHub can take a while (an organization picker, a request to an admin).
const INSTALL_WINDOW_MS = 15 * 60_000

let signIn: { code: DeviceCode; abort: AbortController } | null = null
let pendingInstall: { owner: string; until: number } | null = null

function notify(event: CloudGithubEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(CLOUD_GITHUB_EVENT, event)
    }
  }
}

function errorText(error: unknown): string {
  if (isNetworkFailure(error)) {
    return GITHUB_SIGN_IN_OFFLINE
  }
  return error instanceof Error ? error.message : String(error)
}

function publicSignIn(code: DeviceCode): CloudGithubSignIn {
  return {
    userCode: code.userCode,
    verificationUri: code.verificationUri,
    expiresAt: code.expiresAt
  }
}

function liveSignIn(): CloudGithubSignIn | null {
  if (signIn && Date.now() >= signIn.code.expiresAt) {
    signIn = null
  }
  return signIn ? publicSignIn(signIn.code) : null
}

function pendingInstallOwner(): string | null {
  if (pendingInstall && Date.now() >= pendingInstall.until) {
    pendingInstall = null
  }
  return pendingInstall?.owner ?? null
}

const UserSchema = z.object({ login: z.string(), id: z.number() })

const READ_USER_RETRY_DELAYS_MS = [2_000, 5_000, 10_000]

/**
 * By now GitHub has spent the device code, so a dropped connection here must not throw the new
 * tokens away: the read is tried again before the sign-in is reported as failed.
 */
async function readUser(
  apiBase: string,
  token: string
): Promise<{ login: string; userId: number }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/user`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'user-agent': FORK_PRODUCT_NAME
        },
        signal: AbortSignal.timeout(15_000)
      })
      if (response.ok) {
        const user = UserSchema.parse(await response.json())
        return { login: user.login, userId: user.id }
      }
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`GitHub answered ${response.status} while reading your account.`)
      }
    } catch (error) {
      if (!isNetworkFailure(error)) {
        throw error
      }
    }
    const delay = READ_USER_RETRY_DELAYS_MS[attempt]
    if (delay === undefined) {
      throw new Error(GITHUB_SIGN_IN_OFFLINE)
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

/** Starts a device-flow sign-in; the poll runs on and reports through the GitHub event. */
async function startSignIn(): Promise<CloudGithubSignIn> {
  const config = currentGithubAppConfig()
  if (!config.configured) {
    throw new Error(config.message)
  }
  signIn?.abort.abort()
  const code = await requestDeviceCode(config.webBase, config.clientId, fetch)
  const current = { code, abort: new AbortController() }
  signIn = current
  void (async () => {
    try {
      const tokens = await pollDeviceToken(config.webBase, config.clientId, code, {
        fetchImpl: fetch,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: Date.now,
        signal: current.abort.signal
      })
      const user = await readUser(config.apiBase, tokens.accessToken)
      // Cancel, sign-out or a newer sign-in during the last request wins over this answer.
      if (current.abort.signal.aborted) {
        return
      }
      saveGithubSession(config, tokens, user)
      dismissGithubMigrationNotice()
      forgetGithubCoverage()
      notify({ error: null })
    } catch (error) {
      if (!(error instanceof DeviceFlowError && error.reason === 'cancelled')) {
        notify({ error: errorText(error) })
      }
    } finally {
      if (signIn === current) {
        signIn = null
      }
    }
  })()
  return publicSignIn(code)
}

function cancelSignIn(): void {
  signIn?.abort.abort()
  signIn = null
}

export function registerCloudGithubHandlers(getRepos: () => Repo[]): void {
  try {
    migrateGithubPatFiles()
  } catch (error) {
    bestEffort('Removing the old GitHub tokens')(error)
  }
  startDefaultGithubTokenKeeper(getRepos)
  // Every window re-reads the status when the sign-in ends, whether from Settings, the first-run
  // steps (a separate status reader) or an expired refresh token; expiry also raises one toast.
  onGithubSessionChange((event) => {
    if (event === 'signed-out' || event === 'expired') {
      notify({ error: null, expired: event === 'expired' })
    }
  })
  // A refused unseal is latched in the session store, so this fires once until the person acts.
  onSessionKeychainRefused(() => notify({ error: KEYCHAIN_REFUSED, keychainRefused: true }))
  // While an install the person started is open on GitHub, coming back to Orca re-checks it.
  app.on('browser-window-focus', () => {
    if (pendingInstallOwner()) {
      forgetGithubCoverage()
      notify({ error: null })
    }
  })
  ipcMain.handle('cloud:githubStatus', () =>
    readGithubStatus(getRepos, {
      signIn: liveSignIn(),
      pendingInstallOwner: pendingInstallOwner()
    })
  )
  ipcMain.handle('cloud:githubSignIn', () => startSignIn())
  ipcMain.handle('cloud:githubOpenVerification', async () => {
    const current = liveSignIn()
    const config = currentGithubAppConfig()
    // Only GitHub's own https page on the configured host, whatever the device-code answer said.
    const page = current ? new URL(current.verificationUri) : null
    if (page && config.configured && page.protocol === 'https:' && page.host === config.host) {
      await shell.openExternal(page.toString())
    }
  })
  ipcMain.handle('cloud:githubCancelSignIn', () => cancelSignIn())
  ipcMain.handle('cloud:githubSignOut', () => {
    cancelSignIn()
    pendingInstall = null
    signOutGithub()
    forgetGithubCoverage()
  })
  ipcMain.handle('cloud:githubInstall', async (_event, owner: unknown) => {
    const parsed = z.string().refine(isGithubOwner).parse(owner)
    const config = currentGithubAppConfig()
    if (!config.configured) {
      throw new Error(config.message)
    }
    const status = await readGithubStatus(getRepos, { signIn: null, pendingInstallOwner: null })
    const row = status.repos.find((repo) => repo.owner.toLowerCase() === parsed.toLowerCase())
    pendingInstall = { owner: parsed, until: Date.now() + INSTALL_WINDOW_MS }
    await shell.openExternal(row?.installUrl ?? githubAppInstallUrl(config))
  })
  ipcMain.handle('cloud:githubRecheck', () => {
    retrySessionUnseal()
    forgetGithubCoverage()
    notify({ error: null })
  })
  ipcMain.handle('cloud:githubDismissNotice', () => dismissGithubMigrationNotice())
  ipcMain.handle('cloud:githubAppOverride', () => readGithubAppOverride())
  ipcMain.handle('cloud:githubSetAppOverride', (_event, input: unknown) => {
    const saved = writeGithubAppOverride(input)
    cancelSignIn()
    forgetGithubCoverage()
    notify({ error: null })
    return saved
  })
}
