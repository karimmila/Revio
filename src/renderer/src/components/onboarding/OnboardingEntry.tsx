import { useAppStore } from '@/store'
import type { OnboardingState } from '../../../../shared/onboarding-state-types'
import OnboardingFlow from './OnboardingFlow'
import { WorkspaceOnboardingFlow } from './workspace/WorkspaceOnboardingFlow'
import { WorkspaceSetupImportGate } from './workspace/WorkspaceSetupImportGate'

type OnboardingEntryProps = {
  onboarding: OnboardingState
  onOnboardingChange: (state: OnboardingState) => void
}

/** The Workspace Layout gets the fork's first run; upstream's flow stays for the classic layout. */
export default function OnboardingEntry(props: OnboardingEntryProps): React.JSX.Element | null {
  const layout = useAppStore((s) => (s.settings ? s.settings.revioLayout === true : null))
  if (layout === null) {
    return null
  }
  return layout ? (
    <WorkspaceSetupImportGate>
      <WorkspaceOnboardingFlow {...props} />
    </WorkspaceSetupImportGate>
  ) : (
    <OnboardingFlow {...props} />
  )
}
