import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  getClaudeAccountErrorDescription,
  isClaudeAccountCancellation
} from '@/components/settings/accounts/accounts-pane-action-errors'

/**
 * First sign-in when no Orca Claude account exists: Orca's own browser login (claude.ai, with
 * Google or email), then select the new account so chats run on it.
 */
export async function addAndSelectClaudeAccount(): Promise<boolean> {
  try {
    const listed = await window.api.claudeAccounts.add()
    const newest = [...(listed?.accounts ?? [])].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    )[0]
    if (newest) {
      await window.api.claudeAccounts.select({ accountId: newest.id })
    }
    await useAppStore.getState().fetchSettings()
    return Boolean(newest)
  } catch (error) {
    if (!isClaudeAccountCancellation(error)) {
      toast.error(translate('auto.lib.claudeAccountAdd.failed', 'Could not sign in to Claude.'), {
        description: getClaudeAccountErrorDescription(error)
      })
    }
    return false
  }
}
