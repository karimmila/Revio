import { ipcMain } from 'electron'
import {
  cancelVercelSignIn,
  disconnectVercel,
  readVercelStatus,
  connectVercelToken,
  selectVercelTeam,
  startVercelSignIn,
  waitForVercelSignIn
} from './vercel-cloud-auth'

export function registerVercelCloudHandlers(): void {
  ipcMain.handle('vercelCloud:status', () => readVercelStatus())
  ipcMain.handle('vercelCloud:startSignIn', () => startVercelSignIn())
  ipcMain.handle('vercelCloud:waitForSignIn', () => waitForVercelSignIn())
  ipcMain.handle('vercelCloud:cancelSignIn', () => cancelVercelSignIn())
  ipcMain.handle('vercelCloud:disconnect', () => disconnectVercel())
  ipcMain.handle('vercelCloud:connectToken', (_event, token: unknown) => {
    if (typeof token !== 'string') {
      throw new Error('Paste a Vercel access token.')
    }
    return connectVercelToken(token)
  })
  ipcMain.handle('vercelCloud:selectTeam', (_event, teamId: unknown) => {
    if (typeof teamId !== 'string' || !teamId) {
      throw new Error('Unknown team')
    }
    return selectVercelTeam(teamId)
  })
}
