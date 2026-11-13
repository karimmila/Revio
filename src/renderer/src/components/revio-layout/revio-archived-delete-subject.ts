import { getIntlLocale, translate } from '@/i18n/i18n'
import type { ArchivedWorkspace } from '../../../../shared/revio-archive-types'

type Subject = Pick<ArchivedWorkspace, 'id' | 'displayName' | 'branch' | 'archivedAt'>

/**
 * What the Delete question calls the archived workspace. Its name alone, unless another archived
 * workspace has the same name: then its branch and the time it was archived tell them apart, so
 * the person does not delete the wrong one for good.
 */
export function archivedDeleteSubject(
  record: Subject,
  all: readonly Subject[],
  formatDate: (timestamp: number) => string = (timestamp) =>
    new Date(timestamp).toLocaleString(getIntlLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
): string {
  const shared = all.some(
    (other) => other.id !== record.id && other.displayName === record.displayName
  )
  if (!shared) {
    return record.displayName
  }
  const archived = translate(
    'auto.components.revioLayout.deleteArchivedWhen',
    'archived {{value0}}',
    { value0: formatDate(record.archivedAt) }
  )
  return `${record.displayName} (${[record.branch, archived].filter(Boolean).join(', ')})`
}
