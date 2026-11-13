// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ArtifactPublishButton } from '@/components/artifacts/ArtifactPublishButton'
import { SkillsPageHeader } from '@/components/skills/SkillsPageHeader'
import { shouldShowArtifactsButton, shouldShowMobileButton } from '@/components/sidebar/SidebarNav'
import { getInstallCopy } from '@/components/mobile/mobile-platform-copy'
import { buildSetupSettingsSections } from '@/hooks/settings-navigation-capability-sections'
import { buildWorkflowSettingsSections } from '@/hooks/settings-navigation-workflow-sections'
import type { SettingsNavigationBuildOptions } from '@/hooks/settings-navigation-build-options'

// Every hosted service in fork-identity.json ships off, so none of these entry points may show.
afterEach(cleanup)

const OPTIONS: SettingsNavigationBuildOptions = {
  isMac: true,
  isWindows: false,
  isLocalWindowsHost: false,
  isWindowsTerminalHost: false,
  isWebClient: false,
  hostQueuesMessages: true,
  managedBrowserCreationEnabled: true,
  mobileEmulatorCreationEnabled: true,
  isDev: false,
  isLinearConnected: false,
  repos: []
}

describe('cloud entry points with every hosted service off', () => {
  it('hides the mobile, account, artifact and skill-sharing settings pages', () => {
    const ids = [
      ...buildSetupSettingsSections(OPTIONS),
      ...buildWorkflowSettingsSections(OPTIONS, [])
    ].map((section) => section.id)
    expect(ids).not.toContain('mobile')
    expect(ids).not.toContain('orca-account')
    expect(ids).not.toContain('artifacts')
    expect(ids).not.toContain('share-skills')
    expect(ids).toContain('automations')
  })

  it('hides the sidebar Mobile and Artifacts buttons whatever the settings say', () => {
    expect(shouldShowMobileButton({ showMobileButton: true })).toBe(false)
    expect(shouldShowArtifactsButton({ showArtifactsButton: true })).toBe(false)
  })

  it('renders no artifact share button', () => {
    const { container } = render(
      <ArtifactPublishButton sourceKey="file:/a.html" createRequest={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers no upstream Android download', () => {
    expect(getInstallCopy('android').url).toBeNull()
  })

  it('shows no share, shared-links or install-from-link actions on the Skills page', () => {
    render(
      <TooltipProvider>
        <SkillsPageHeader
          skillCount={1}
          sourceEntries={[]}
          scannedSourceCount={0}
          hostLabel={null}
          onClose={vi.fn()}
          deleteSupported
          deleteUnsupportedReason={null}
          onStartDelete={vi.fn()}
          onManageInstalls={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.queryByText('Share skills')).toBeNull()
    expect(screen.queryByText('Install from link')).toBeNull()
  })
})
