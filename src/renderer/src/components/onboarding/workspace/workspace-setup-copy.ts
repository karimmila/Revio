import { translate } from '@/i18n/i18n'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import type { WorkspaceSetupStepId } from '../../../../../shared/workspace-setup'
import type { SetupStatus } from './workspace-setup-steps'

export function workspaceSetupWelcome(productName: string): string {
  return translate('components.onboarding.workspace.welcome', 'Welcome to {{name}}', {
    name: productName
  })
}

export function workspaceSetupStepLabel(id: WorkspaceSetupStepId): string {
  switch (id) {
    case 'agent':
      return translate('components.onboarding.workspace.step.agent', 'Claude')
    case 'cloud':
      return translate('components.onboarding.workspace.step.cloud', 'Cloud')
    case 'project':
      return translate('components.onboarding.workspace.step.project', 'Project')
    case 'github':
      return translate('components.onboarding.workspace.step.github', 'GitHub')
    case 'finish':
      return translate('components.onboarding.workspace.step.finish', 'Done')
  }
}

export function workspaceSetupStepCopy(id: WorkspaceSetupStepId): {
  title: string
  subtitle: string
} {
  switch (id) {
    case 'agent':
      return {
        title: translate('components.onboarding.workspace.agent.title', 'Sign in to Claude'),
        subtitle: translate(
          'components.onboarding.workspace.agent.subtitle',
          'Agents work with your own Claude account. Sign in on this Mac, and save a setup token so cloud workspaces can use it too.'
        )
      }
    case 'cloud':
      return {
        title: translate('components.onboarding.workspace.cloud.title', 'Connect Vercel'),
        subtitle: translate(
          'components.onboarding.workspace.cloud.subtitle',
          'Each cloud workspace runs in its own Vercel Sandbox on your Vercel account.'
        )
      }
    case 'project':
      return {
        title: translate('components.onboarding.workspace.project.title', 'Add a project'),
        subtitle: translate(
          'components.onboarding.workspace.project.subtitle',
          'Open a repository from GitHub or a folder on this Mac. Then pick where new workspaces run.'
        )
      }
    case 'github':
      return {
        title: translate('components.onboarding.workspace.github.title', 'Connect GitHub'),
        subtitle: translate(
          'components.onboarding.workspace.github.appSubtitle',
          'Sign in with GitHub so {{name}} can push branches, open pull requests and read checks, on this Mac and in the cloud. It works only for the owners where you install the {{name}} GitHub App.',
          { name: FORK_PRODUCT_NAME }
        )
      }
    case 'finish':
      return {
        title: translate('components.onboarding.workspace.finish.title', 'You are ready'),
        subtitle: translate(
          'components.onboarding.workspace.finish.subtitle',
          'Start your first workspace, or finish and look around. You can change all of this later in Settings.'
        )
      }
  }
}

export function setupStatusLabel(status: SetupStatus): string {
  switch (status) {
    case 'checking':
      return translate('components.onboarding.workspace.status.checking', 'Checking…')
    case 'connected':
      return translate('components.onboarding.workspace.status.connected', 'Connected')
    case 'not-connected':
      return translate('components.onboarding.workspace.status.notConnected', 'Not connected')
  }
}
