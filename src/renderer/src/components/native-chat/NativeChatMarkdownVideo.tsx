import { useContext, useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { userNamedFileAccess } from '@/lib/local-file-access'
import { filePreviewForPath } from '../../../../shared/file-preview-kind'
import {
  createNativeChatFileHref,
  routeNativeChatHref
} from '../../../../shared/native-chat/native-chat-href-routing'
import { NativeChatMarkdownImageOwnerContext } from './native-chat-markdown-image-owner'
import { resolveNativeChatFileLink } from './native-chat-file-link'

/** A markdown image whose source is a video file plays inline instead (chat video). */
export function isNativeChatVideoSource(src: string | undefined): boolean {
  if (!src) {
    return false
  }
  const path = src.split(/[?#]/)[0] ?? ''
  return filePreviewForPath(path)?.kind === 'video'
}

type Shown =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; src: string }
  | { kind: 'failed' }

/**
 * Plays a video an agent put in a chat. A web URL plays directly; a local file needs a click
 * first (a user gesture grants the read), then streams through Orca's media preview. Files on a
 * remote host do not play inline.
 */
export function NativeChatMarkdownVideo({
  src,
  alt
}: {
  src: string
  alt?: string
}): React.JSX.Element {
  const owner = useContext(NativeChatMarkdownImageOwnerContext)
  const web = /^https?:/i.test(src)
  const [shown, setShown] = useState<Shown>(web ? { kind: 'ready', src } : { kind: 'idle' })
  const context = owner?.runtimeContext
  const fileLinkContext = owner?.fileLinkContext
  const route = routeNativeChatHref(src)
  const target =
    !web &&
    context?.worktreePath &&
    !context.connectionId &&
    context.target.kind === 'local' &&
    fileLinkContext &&
    route.kind === 'file'
      ? resolveNativeChatFileLink(createNativeChatFileHref(route.pathText, 'literal'), {
          ...fileLinkContext,
          worktreeId: context.worktreeId ?? fileLinkContext.worktreeId,
          worktreePath: context.worktreePath,
          runtimeEnvironmentId: null
        })
      : null
  const title = alt?.trim() || (target ? basename(target.absolutePath) : basename(src))
  const load = (): void => {
    if (!target) {
      setShown({ kind: 'failed' })
      return
    }
    setShown({ kind: 'loading' })
    void window.api.fs
      .readFile({
        filePath: target.absolutePath,
        access: userNamedFileAccess(),
        rangePreview: true
      })
      .then((content) =>
        setShown(content.mediaUrl ? { kind: 'ready', src: content.mediaUrl } : { kind: 'failed' })
      )
      .catch(() => setShown({ kind: 'failed' }))
  }
  if (shown.kind === 'ready') {
    return (
      <video
        data-native-chat-video
        src={shown.src}
        controls
        preload="metadata"
        aria-label={title}
        onError={() => setShown({ kind: 'failed' })}
        className="my-2 block max-h-96 max-w-full rounded-md bg-black outline outline-1 outline-border/70"
      />
    )
  }
  if (shown.kind === 'failed' || !target) {
    return (
      <span role="status" className="text-sm text-muted-foreground">
        {translate('components.native-chat.video.unavailable', 'Video unavailable: {{value0}}', {
          value0: title
        })}
      </span>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-native-chat-video-play
      disabled={shown.kind === 'loading'}
      onClick={load}
    >
      <Play />
      {translate('components.native-chat.video.play', 'Play {{value0}}', { value0: title })}
    </Button>
  )
}
