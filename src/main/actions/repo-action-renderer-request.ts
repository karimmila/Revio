import { randomUUID } from 'node:crypto'
import type { BrowserWindow, IpcMainEvent } from 'electron'
import {
  REPO_ACTION_AGENT_REPLY_CHANNEL,
  REPO_ACTION_AGENT_REQUEST_CHANNEL,
  type RepoActionAgentReply,
  type RepoActionAgentRequestBody
} from '../../shared/actions/repo-action-agent-bridge'
import { getRuntimeDesktopSurface } from '../runtime/runtime-desktop-surface'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/**
 * Asks the window, which owns the Run tab and the workspace's cloud/mirror state, to resolve or
 * run a repository action for `orca action`, and waits for its reply.
 */
export function askRendererForRepoAction(
  win: BrowserWindow,
  body: RepoActionAgentRequestBody,
  timeoutMs = 15_000
): Promise<RepoActionAgentReply> {
  const surface = getRuntimeDesktopSurface()
  const requestId = randomUUID()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      surface.removeIpcListener(REPO_ACTION_AGENT_REPLY_CHANNEL, handler)
      reject(
        new Error(`The ${FORK_PRODUCT_NAME} window did not answer the action request in time.`)
      )
    }, timeoutMs)
    const handler = (event: IpcMainEvent, reply: RepoActionAgentReply): void => {
      if (event.sender !== win.webContents || reply?.requestId !== requestId) {
        return
      }
      clearTimeout(timer)
      surface.removeIpcListener(REPO_ACTION_AGENT_REPLY_CHANNEL, handler)
      resolve(reply)
    }
    surface.onIpc(REPO_ACTION_AGENT_REPLY_CHANNEL, handler)
    win.webContents.send(REPO_ACTION_AGENT_REQUEST_CHANNEL, { ...body, requestId })
  })
}
