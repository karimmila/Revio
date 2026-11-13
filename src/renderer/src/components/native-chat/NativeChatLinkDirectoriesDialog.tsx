import { useRef, useState } from 'react'
import { Check, Folder, FolderPlus, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { readNativeChatAccountUsageModalRequest } from './native-chat-account-usage-modal'
import { restartRevioChatAgent, withLinkedDirectory } from './native-chat-revio-commands'
import { linkableWorkspaces, withoutLinkedDirectory } from './native-chat-linked-directories'

/** "Link workspaces": the folders and other workspaces this workspace's chats may
 * use (`/add-dir`). A change restarts the agent on its next message so it gets them. */
export default function NativeChatLinkDirectoriesDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const [request] = useState(() => readNativeChatAccountUsageModalRequest(modalData))
  const worktreeId = typeof modalData.worktreeId === 'string' ? modalData.worktreeId : null
  const workspace = useAppStore((s) =>
    worktreeId ? findWorktreeById(selectWorktreesByRepo(s), worktreeId) : undefined
  )
  const worktreesByRepo = useAppStore((s) => selectWorktreesByRepo(s))
  const linked = useAppStore((s) => s.settings?.revioLinkedDirectories)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const changed = useRef(false)
  if (!request || !workspace) {
    return null
  }
  const folders = linked?.[workspace.path] ?? []
  const toggle = (folder: string): void => {
    changed.current = true
    void updateSettings({
      revioLinkedDirectories: folders.includes(folder)
        ? withoutLinkedDirectory(linked, workspace.path, folder)
        : withLinkedDirectory(linked, workspace.path, folder)
    })
  }
  const close = (): void => {
    if (changed.current) {
      void restartRevioChatAgent(request)
    }
    closeModal()
  }
  const others = linkableWorkspaces(worktreesByRepo, workspace)
  const otherPaths = new Set(others.map((other) => other.path))
  const plainFolders = folders.filter((folder) => !otherPaths.has(folder))
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>
          {translate('components.native-chat.linkDirectories.title', 'Link workspaces')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'components.native-chat.linkDirectories.description',
            'Link a directory or workspace. The agent can read and edit it from your next message.'
          )}
        </DialogDescription>
        <ul className="scrollbar-sleek flex max-h-80 flex-col overflow-y-auto">
          {plainFolders.map((folder) => (
            <li key={folder} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <Folder className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={folder}>
                {folder}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={translate('components.native-chat.linkDirectories.remove', 'Remove')}
                onClick={() => toggle(folder)}
              >
                <X />
              </Button>
            </li>
          ))}
          {others.map((other) => {
            const on = folders.includes(other.path)
            return (
              <li key={other.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(other.path)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    {on ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{other.displayName}</span>
                  <span
                    className="max-w-[45%] truncate text-xs text-muted-foreground"
                    title={other.path}
                  >
                    {other.path}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void window.api.repos.pickDirectory().then((folder) => {
                if (folder && !folders.includes(folder)) {
                  toggle(folder)
                }
              })
            }
          >
            <FolderPlus />
            {translate('components.native-chat.linkDirectories.addFolder', 'Add folder…')}
          </Button>
          <Button type="button" size="sm" onClick={close}>
            {translate('components.native-chat.linkDirectories.done', 'Done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
