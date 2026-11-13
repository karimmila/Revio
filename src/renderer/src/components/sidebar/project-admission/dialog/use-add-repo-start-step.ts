import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/index'

/**
 * Opens the dialog on the step `modalData.startStep` names ("clone" for "Open GitHub project",
 * "create" for Quick start), once per opening and only after a host is chosen, as the step buttons require.
 */
export function useAddRepoStartStep(
  isOpen: boolean,
  selectedHostId: string | null | undefined,
  openStep: { clone: () => void; create: () => void }
): void {
  const startStep = useAppStore((s) => s.modalData?.startStep)
  const applied = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      applied.current = false
      return
    }
    if (!applied.current && (startStep === 'clone' || startStep === 'create') && selectedHostId) {
      applied.current = true
      openStep[startStep]()
    }
  }, [isOpen, selectedHostId, startStep, openStep])
}
