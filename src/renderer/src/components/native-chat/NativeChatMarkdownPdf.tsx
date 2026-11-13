import { useContext } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { filePreviewForPath } from '../../../../shared/file-preview-kind'
import {
  createNativeChatFileHref,
  routeNativeChatHref
} from '../../../../shared/native-chat/native-chat-href-routing'
import { NativeChatMarkdownImageOwnerContext } from './native-chat-markdown-image-owner'
import { useNativeChatFileLinkClick } from './use-native-chat-file-link-click'

export function isNativeChatPdfSource(src: string | undefined): boolean {
  return Boolean(src) && filePreviewForPath((src ?? '').split(/[?#]/)[0] ?? '')?.kind === 'pdf'
}

/** A markdown image whose source is a local PDF: a chip that opens it in Orca's PDF viewer, the
 * same as clicking a file link to it. */
export function NativeChatMarkdownPdf({
  src,
  alt
}: {
  src: string
  alt?: string
}): React.JSX.Element {
  const owner = useContext(NativeChatMarkdownImageOwnerContext)
  const onFileLinkClick = useNativeChatFileLinkClick(owner?.fileLinkContext ?? null)
  const route = routeNativeChatHref(src)
  const href = route.kind === 'file' ? createNativeChatFileHref(route.pathText, 'literal') : null
  const title = alt?.trim() || basename(src.split(/[?#]/)[0] ?? src)
  if (!href || !onFileLinkClick) {
    return <span>{title}</span>
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-native-chat-pdf
      title={translate('components.native-chat.pdf.open', 'Open PDF')}
      onClick={(event) => onFileLinkClick(event, href)}
    >
      <FileText />
      {title}
    </Button>
  )
}
