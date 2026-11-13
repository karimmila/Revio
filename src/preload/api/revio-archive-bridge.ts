import { ipcRenderer } from 'electron'
import type { ArchivedWorkspace } from '../../shared/revio-archive-types'

export type RevioArchiveApi = {
  list: () => Promise<ArchivedWorkspace[]>
  add: (record: ArchivedWorkspace) => Promise<void>
  /** Unarchive's removal; `unarchivedAs` is the id the workspace came back with (its own by default). */
  remove: (id: string, unarchivedAs?: string) => Promise<void>
  /** Delete for good: the record, its cloud restore snapshot or its local checkpoint refs. */
  delete: (id: string) => Promise<void>
}

export const revioArchiveApi: RevioArchiveApi = {
  list: () => ipcRenderer.invoke('revioArchive:list'),
  add: (record) => ipcRenderer.invoke('revioArchive:add', record),
  remove: (id, unarchivedAs) => ipcRenderer.invoke('revioArchive:remove', id, unarchivedAs),
  delete: (id) => ipcRenderer.invoke('revioArchive:delete', id)
}
