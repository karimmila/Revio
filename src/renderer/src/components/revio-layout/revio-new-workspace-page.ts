import { useAppStore } from '@/store'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export function revioNewWorkspacePageOn(
  settings: Pick<GlobalSettings, 'revioLayout' | 'revioNewWorkspacePage'> | null | undefined
): boolean {
  return settings?.revioLayout === true && settings.revioNewWorkspacePage === true
}

/** The experimental "New workspace page": Create is a full page in the main area. */
export function useRevioNewWorkspacePage(): boolean {
  return useAppStore((s) => revioNewWorkspacePageOn(s.settings))
}

/** Escape leaves the page only when it was pressed in the page itself and no menu is open over it. */
export function revioCreatePageEscapes(
  event: Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'target'>,
  page: Element | null,
  documentRoot: Pick<Document, 'querySelector'>
): boolean {
  return (
    event.key === 'Escape' &&
    !event.defaultPrevented &&
    event.target instanceof Node &&
    page !== null &&
    page.contains(event.target) &&
    documentRoot.querySelector('[data-radix-popper-content-wrapper]') === null
  )
}
