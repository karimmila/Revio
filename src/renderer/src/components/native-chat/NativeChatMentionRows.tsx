import { FolderGit2, MessageSquare, SquareTerminal } from 'lucide-react'
import { FilenameFirstPath } from '@/components/file-path-cursor-tooltip'
import { FileTypeIcon } from '@/components/FileTypeIcon'
import type { NativeChatMentionSource } from './native-chat-mention-sources'

export function MentionFileRow({ path }: { path: string }): React.JSX.Element {
  return (
    <>
      <FileTypeIcon filePath={path} className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <FilenameFirstPath path={path} />
    </>
  )
}

const ICONS = { chat: MessageSquare, terminal: SquareTerminal, workspace: FolderGit2 } as const

export function NativeChatMentionSourceRow({
  source
}: {
  source: NativeChatMentionSource | undefined
}): React.JSX.Element | null {
  if (!source) {
    return null
  }
  const Icon = ICONS[source.kind]
  return (
    <>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{source.label}</span>
      {source.detail ? (
        <span className="ml-auto min-w-0 shrink truncate pl-2 text-muted-foreground">
          {source.detail}
        </span>
      ) : null}
    </>
  )
}
