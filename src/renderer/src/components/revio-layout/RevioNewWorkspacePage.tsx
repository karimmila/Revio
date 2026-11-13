import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { Dialog } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { getWorkspaceComposerInitialFocusTarget } from '@/lib/workspace-composer-initial-focus'
import {
  QuickTabBody,
  selectComposerModalData,
  type ComposerModalData
} from '@/components/NewWorkspaceComposerModal'
import { revioCreatePageEscapes, useRevioNewWorkspacePage } from './revio-new-workspace-page'

/**
 * The experimental "New workspace page": the Create composer as a full page over the main
 * area, the sidebar still beside it. Opens wherever the Create modal would; a direct work-item
 * setup stays a dialog.
 */
export function RevioNewWorkspacePage(): React.JSX.Element | null {
  const on = useRevioNewWorkspacePage()
  const visible = useAppStore((s) => s.activeModal === 'new-workspace-composer')
  const modalData = useAppStore(selectComposerModalData)
  const closeModal = useAppStore((s) => s.closeModal)
  if (!on || !visible || modalData?.directSetup) {
    return null
  }
  return <CreatePage modalData={modalData ?? {}} onClose={closeModal} />
}

function CreatePage({
  modalData,
  onClose
}: {
  modalData: ComposerModalData
  onClose: () => void
}): React.JSX.Element {
  const pageRef = useRef<HTMLElement>(null)
  const submitCancelledRef = useRef(false)
  const dismiss = useCallback(() => {
    submitCancelledRef.current = true
    onClose()
  }, [onClose])
  const isSubmissionCancelled = useCallback(() => submitCancelledRef.current, [])
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeView = useAppStore((s) => s.activeView)
  const opened = useRef({ activeWorktreeId, activeView })

  useEffect(() => {
    const page = pageRef.current
    if (page) {
      getWorkspaceComposerInitialFocusTarget(page)?.focus({ preventScroll: true })
    }
  }, [])
  // Like leaving the workspace layout's create route: opening a workspace or another view closes
  // the page. A plain close, not a dismissal: a create in flight may switch the workspace and must
  // finish.
  useEffect(() => {
    if (
      activeWorktreeId !== opened.current.activeWorktreeId ||
      activeView !== opened.current.activeView
    ) {
      onClose()
    }
  }, [activeView, activeWorktreeId, onClose])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (revioCreatePageEscapes(event, pageRef.current, document)) {
        event.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  return (
    <section
      ref={pageRef}
      data-revio-new-workspace-page=""
      aria-label={translate('auto.components.revioLayout.newWorkspacePage.label', 'New workspace')}
      className="scrollbar-sleek absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-background px-4 pt-[12vh] pb-6"
    >
      {/* The composer's title and description are Radix dialog parts that need a Dialog root; a
          non-modal root with no content gives them one without an overlay or a focus trap. */}
      <Dialog open modal={false}>
        <div className="flex w-full max-w-[702px] flex-col overflow-hidden rounded-[10px] border border-border bg-card">
          <QuickTabBody
            modalData={modalData}
            onClose={onClose}
            isSubmissionCancelled={isSubmissionCancelled}
            active
          />
        </div>
      </Dialog>
    </section>
  )
}
