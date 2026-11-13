import type { ReactNode } from 'react'
import { RecoverableRenderErrorBoundary } from '@/components/error-boundaries/RecoverableRenderErrorBoundary'
import { translate } from '@/i18n/i18n'

/**
 * One transcript row that throws while drawing shows the workspace layout's notice in its place, so
 * the rest of the chat stays readable instead of the whole pane failing.
 */
export function NativeChatRowErrorBoundary({ children }: { children: ReactNode }): ReactNode {
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="native-chat.transcript-row"
      surface="terminal-workbench"
      compact
      reportAsCrash={false}
      title={translate(
        'components.native-chat.rowRenderFailed.title',
        'This chat turn failed to render'
      )}
      description={translate(
        'components.native-chat.rowRenderFailed.description',
        'Other turns are still available.'
      )}
    >
      {children}
    </RecoverableRenderErrorBoundary>
  )
}
