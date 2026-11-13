import { translate } from '@/i18n/i18n'
import type {
  ChecksPanelRecoveryAction,
  ChecksPanelReviewState,
  ChecksPanelReviewStateInput
} from '../checks-panel-review-state-model'
import { FORK_PRODUCT_NAME } from '../../../../../../shared/fork-identity'
import type { KeyedCopy } from './checks-panel-review-copy'
import { requiredToolInstallCommand } from '../../../../../../shared/missing-tool-install'

const HARD_ERROR_COPY: Record<
  | 'auth'
  | 'permission'
  | 'repo_unavailable'
  | 'gh_unavailable'
  | 'github_sign_in'
  | 'app_not_installed',
  {
    title: KeyedCopy
    body: KeyedCopy
  }
> = {
  auth: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.auth.title',
      fallback: '{{provider}} authentication failed'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.auth.body',
      fallback:
        '{{provider}} could not authenticate the credentials available in this environment. Check the {{provider}} login or environment token, then retry.'
    }
  },
  permission: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.permission.title',
      fallback: '{{provider}} access denied'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.permission.body',
      fallback:
        "The current {{provider}} credentials cannot read this repository's {{reviewLabel}}s. Check the account, token scopes, and repository access, then retry."
    }
  },
  repo_unavailable: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.repo.title',
      fallback: '{{provider}} repository unavailable'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.repo.body',
      fallback:
        '{{provider}} could not resolve or access the repository for the current remote and account. Check the remote and repository access, then retry.'
    }
  },
  github_sign_in: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.githubSignIn.title',
      fallback: 'Sign in with GitHub'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.githubSignIn.body',
      fallback:
        '{{productName}} uses its GitHub App sign-in for {{reviewLabel}}s. Sign in with GitHub in Settings > Account.'
    }
  },
  app_not_installed: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.installApp.title',
      fallback: 'Install {{productName}} on {{owner}}'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.installApp.body',
      fallback:
        "The {{productName}} GitHub App is not installed on {{owner}}, so {{productName}} does not check this repository's {{reviewLabel}}s. Install it, then retry."
    }
  },
  gh_unavailable: {
    title: {
      key: 'auto.components.right.sidebar.checks.panel.review.cli.title',
      fallback: '{{provider}} CLI unavailable'
    },
    body: {
      key: 'auto.components.right.sidebar.checks.panel.review.cli.body',
      fallback: `${FORK_PRODUCT_NAME} could not run {{provider}} CLI in this environment. Set it up here, then retry.`
    }
  }
}

export function hardRefreshErrorState(input: ChecksPanelReviewStateInput): ChecksPanelReviewState {
  const { reviewLabel, providerName, refresh } = input
  const copy =
    HARD_ERROR_COPY[(refresh?.errorType as keyof typeof HARD_ERROR_COPY) ?? 'gh_unavailable'] ??
    HARD_ERROR_COPY.gh_unavailable
  const vars = {
    provider: providerName,
    reviewLabel,
    owner:
      refresh?.installOwner ??
      translate(
        'auto.components.right.sidebar.checks.panel.review.installApp.ownerFallback',
        'this owner'
      )
  }
  const recovery: ChecksPanelRecoveryAction[] =
    refresh?.errorType === 'github_sign_in'
      ? ['github_sign_in']
      : refresh?.errorType === 'app_not_installed'
        ? ['install_app', 'retry']
        : ['retry']
  // With gh absent, name the command that installs it instead of "set it up here".
  const ghInstallCommand =
    copy === HARD_ERROR_COPY.gh_unavailable && providerName === 'GitHub'
      ? requiredToolInstallCommand('gh', window.api?.platform?.get?.().platform ?? '')
      : null
  return {
    renderReview: false,
    title: translate(copy.title.key, copy.title.fallback, vars),
    description: ghInstallCommand
      ? translate(
          'auto.components.right.sidebar.checks.panel.review.cli.bodyInstall',
          '{{productName}} could not run the GitHub CLI (gh) on this computer. Install it by running {{command}} in a terminal, then retry.',
          { command: ghInstallCommand }
        )
      : translate(copy.body.key, copy.body.fallback, vars),
    composerMode: 'hidden',
    workflowAction: null,
    recovery
  }
}
