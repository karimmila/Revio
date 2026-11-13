import { ipcRenderer } from 'electron'
import type {
  VercelCloudStatus,
  VercelSignInStart
} from '../../shared/vercel-cloud/vercel-cloud-types'

export type VercelCloudApi = {
  status: () => Promise<VercelCloudStatus>
  startSignIn: () => Promise<VercelSignInStart>
  waitForSignIn: () => Promise<VercelCloudStatus>
  cancelSignIn: () => Promise<void>
  disconnect: () => Promise<void>
  selectTeam: (teamId: string) => Promise<VercelCloudStatus>
  connectToken: (token: string) => Promise<VercelCloudStatus>
}

export const vercelCloudApi: VercelCloudApi = {
  status: () => ipcRenderer.invoke('vercelCloud:status'),
  startSignIn: () => ipcRenderer.invoke('vercelCloud:startSignIn'),
  waitForSignIn: () => ipcRenderer.invoke('vercelCloud:waitForSignIn'),
  cancelSignIn: () => ipcRenderer.invoke('vercelCloud:cancelSignIn'),
  disconnect: () => ipcRenderer.invoke('vercelCloud:disconnect'),
  selectTeam: (teamId) => ipcRenderer.invoke('vercelCloud:selectTeam', teamId),
  connectToken: (token) => ipcRenderer.invoke('vercelCloud:connectToken', token)
}
