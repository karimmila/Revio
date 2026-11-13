import type React from 'react'
import { useAppStore } from '@/store'
import type { RevioSettingsPageId } from './revio-settings-view'
import { RevioGeneralSettings } from './RevioGeneralSettings'
import { RevioAccountSettings } from './RevioAccountSettings'
import { RevioAppearanceSettings } from './RevioAppearanceSettings'
import { RevioModelsSettings } from './RevioModelsSettings'
import { RevioGitSettings } from './RevioGitSettings'
import { RevioAgentsSettings } from './RevioAgentsSettings'
import { RevioPromptsSettings } from './RevioPromptsSettings'
import { RevioEnvironmentSettings } from './RevioEnvironmentSettings'
import { RevioCloudSettings } from './RevioCloudSettings'
import { RevioExperimentalSettings } from './RevioExperimentalSettings'
import { RevioRepositorySettings } from './RevioRepositorySettings'
import { RevioShortcutsSettings } from './RevioShortcutsSettings'
import { RevioMcpSettings } from './RevioMcpSettings'
import { RevioAdvancedSettings } from './RevioAdvancedSettings'
import { RevioImportSettings } from './RevioImportSettings'
import { RevioRemoteControlSettings } from './RevioRemoteControlSettings'
import { isForkServiceEnabled } from '../../../../../shared/fork-services'

export function RevioSettingsPageContent({
  page
}: {
  page: RevioSettingsPageId
}): React.JSX.Element | null {
  const loaded = useAppStore((s) => s.settings !== null)
  if (!loaded) {
    return null
  }
  if (page.startsWith('repo:')) {
    return <RevioRepositorySettings repoId={page.slice('repo:'.length)} />
  }
  switch (page) {
    case 'general':
      return <RevioGeneralSettings />
    case 'account':
      return <RevioAccountSettings />
    case 'appearance':
      return <RevioAppearanceSettings />
    case 'shortcuts':
      return <RevioShortcutsSettings />
    case 'models':
      return <RevioModelsSettings />
    case 'git':
      return <RevioGitSettings />
    case 'agents':
      return <RevioAgentsSettings />
    case 'prompts':
      return <RevioPromptsSettings />
    case 'mcp':
      return <RevioMcpSettings />
    case 'environment':
      return <RevioEnvironmentSettings />
    case 'cloud':
      return <RevioCloudSettings />
    case 'experimental':
      return <RevioExperimentalSettings />
    case 'advanced':
      return <RevioAdvancedSettings />
    case 'import':
      return <RevioImportSettings />
    case 'remote':
      return isForkServiceEnabled('relayBaseUrl') ? (
        <RevioRemoteControlSettings />
      ) : (
        <RevioGeneralSettings />
      )
    default:
      return <RevioGeneralSettings />
  }
}
