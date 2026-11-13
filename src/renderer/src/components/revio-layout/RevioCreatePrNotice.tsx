import type React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { addAndSelectClaudeAccount } from '@/lib/claude-account-add'
import { refreshClaudeLoginRoute } from '@/lib/claude-login-route-store'
import { openRevioSettingsPage, type RevioSettingsPageId } from './settings/revio-settings-view'
import { createPrBlockMessage, type CreatePrBlock } from './revio-create-pr-precheck'

function openSettings(page: RevioSettingsPageId): void {
  useAppStore.getState().openSettingsPage()
  openRevioSettingsPage(page)
}

function blockAction(block: CreatePrBlock): { label: string; run: () => void } | null {
  switch (block.kind) {
    case 'claude-sign-in':
      return {
        label: translate('auto.components.revioLayout.createPrBlock.signIn', 'Sign in'),
        run: () => void addAndSelectClaudeAccount().then(() => refreshClaudeLoginRoute())
      }
    case 'github-sign-in':
      return {
        label: block.expired
          ? translate('auto.components.revioLayout.createPrBlock.signInAgain', 'Sign in again')
          : translate(
              'auto.components.revioLayout.createPrBlock.signInWithGithub',
              'Sign in with GitHub'
            ),
        run: () => openSettings('account')
      }
    case 'install-app':
      return {
        label: translate(
          'auto.components.revioLayout.createPrBlock.install',
          'Install {{productName}} on {{owner}}',
          { owner: block.owner }
        ),
        run: () => {
          const install = window.api.cloud?.githubInstall(block.owner)
          void (install ?? Promise.reject(new Error('no cloud api'))).catch(() =>
            openSettings('account')
          )
        }
      }
    case 'no-remote':
      return {
        label: translate(
          'auto.components.revioLayout.createPrBlock.repositorySettings',
          'Repository settings'
        ),
        run: () => openSettings(`repo:${block.repoId}`)
      }
    case 'no-changes':
      return null
  }
}

/** Why Create PR did not start, with the one step that clears it, shown under the button. */
export function RevioCreatePrNotice({
  block,
  onDone
}: {
  block: CreatePrBlock
  onDone: () => void
}): React.JSX.Element {
  const action = blockAction(block)
  return (
    <div role="status" data-create-pr-block={block.kind} className="flex flex-col gap-2.5">
      <p className="text-[13px] leading-snug text-foreground">{createPrBlockMessage(block)}</p>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.run()
            onDone()
          }}
          className="flex h-7 w-fit items-center rounded-md bg-primary px-2.5 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
