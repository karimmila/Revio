import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { nativeChatComposerScopeDestination } from '@/components/native-chat/native-chat-composer-destination'
import type {
  GitHubWorkItem,
  GitHubWorkItemDetails
} from '../../../../../shared/github/work-item-types'
import { workItemContextDocument } from './revio-hash-context-content'

/** Adds the picked PR or issue (description, and a PR's changed files) to the chat input as a
 * text attachment beside the `PR #12 "Title"` line. The toast on failure. */
export async function attachWorkItemContext(
  input: HTMLElement,
  item: Pick<GitHubWorkItem, 'type' | 'number'>,
  readDetails: (
    item: Pick<GitHubWorkItem, 'type' | 'number'>
  ) => Promise<GitHubWorkItemDetails | null>
): Promise<boolean> {
  const scope = input
    .closest('[data-native-chat-composer-scope]')
    ?.getAttribute('data-native-chat-composer-scope')
  const details = scope ? await readDetails(item).catch(() => null) : null
  const composer = scope ? nativeChatComposerScopeDestination(scope) : null
  const attached =
    details !== null &&
    composer?.insertPastedText?.(workItemContextDocument(details), { asAttachment: true }) === true
  if (!attached) {
    toast.error(
      translate('auto.components.revioLayout.hashContext.failed', 'Failed to save PR context')
    )
  }
  return attached
}
