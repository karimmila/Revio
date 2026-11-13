import { useCallback, useMemo } from 'react'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import { useAddRepoStartStep } from './use-add-repo-start-step'

/** Clone and create steps open only once a host is chosen, from a button or the modal's start step. */
export function useAddRepoOpenSteps(input: {
  isOpen: boolean
  selectedHostId: string | null | undefined
  setStep: (step: AddRepoDialogStep) => void
  setCloneError: (error: string | null) => void
  setCreateError: (error: string | null) => void
}): { openCloneStep: () => void; openCreateStep: () => void } {
  const { isOpen, selectedHostId, setStep, setCloneError, setCreateError } = input
  const openCloneStep = useCallback((): void => {
    if (selectedHostId) {
      setCloneError(null)
      setStep('clone')
    }
  }, [selectedHostId, setCloneError, setStep])
  const openCreateStep = useCallback((): void => {
    if (selectedHostId) {
      setCreateError(null)
      setStep('create')
    }
  }, [selectedHostId, setCreateError, setStep])
  const startSteps = useMemo(
    () => ({ clone: openCloneStep, create: openCreateStep }),
    [openCloneStep, openCreateStep]
  )
  useAddRepoStartStep(isOpen, selectedHostId, startSteps)
  return { openCloneStep, openCreateStep }
}
