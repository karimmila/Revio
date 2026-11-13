import type React from 'react'
import { RevioChatNoteChips } from '@/components/revio-layout/RevioChatNoteChips'
import { NativeChatImageAttachmentPreview } from './NativeChatImageAttachmentPreview'
import type { NativeChatComposerImageAttachment } from './native-chat-composer-types'

/** What sits above the prompt inside the composer: review-note chips (Workspace layout) and images. */
export function NativeChatComposerAttachmentRow({
  draftScopeKey,
  imageAttachments,
  attachmentEnvironmentId,
  numberImages,
  onRemoveImageAttachment
}: {
  draftScopeKey: string
  imageAttachments: readonly NativeChatComposerImageAttachment[]
  attachmentEnvironmentId: string | undefined
  numberImages: boolean
  onRemoveImageAttachment: (id: string) => void
}): React.JSX.Element {
  return (
    <>
      <RevioChatNoteChips draftScopeKey={draftScopeKey} />
      {imageAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1.5">
          {imageAttachments.map((attachment, index) => (
            <NativeChatImageAttachmentPreview
              key={attachment.id}
              attachment={attachment}
              hostEnvironmentId={attachmentEnvironmentId}
              number={numberImages ? index + 1 : undefined}
              onRemove={onRemoveImageAttachment}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
