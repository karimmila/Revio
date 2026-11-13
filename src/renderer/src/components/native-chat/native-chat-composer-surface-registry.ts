import { useEffect, type RefObject } from 'react'
import type {
  SessionOptionDescriptor,
  SessionOptionsSurface
} from '../../../../shared/native-chat/input/native-chat-session-options'

type Registered = { surface: SessionOptionsSurface; snapshot: () => SessionOptionDescriptor[] }

const byRoot = new WeakMap<Element, Registered>()

/**
 * Lets app-level keys (the workspace layout's ⇧Tab plan mode, ⌘⇧E fast mode) set an option on
 * the chat whose composer is on screen, through that chat's own option surface.
 */
export function useRegisterComposerSurface(
  root: RefObject<HTMLElement | null> | undefined,
  surface: SessionOptionsSurface | null,
  snapshot: SessionOptionDescriptor[]
): void {
  useEffect(() => {
    const element = root?.current
    if (!element || !surface) {
      return
    }
    byRoot.set(element, { surface, snapshot: () => snapshot })
    return () => {
      byRoot.delete(element)
    }
  }, [root, surface, snapshot])
}

export function composerSurfaceFor(root: Element): Registered | null {
  return byRoot.get(root) ?? null
}
