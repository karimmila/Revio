import type { NativeChatComposerControl } from '@/components/native-chat/NativeChatComposerToolbar'

// In this layout the permissions control is the "Auto-accept edits" toggle.
const CHIP_IDS = new Set(['plan', 'goal', 'permissions'])

/**
 * The composer: the model picker leads on the left, attach and dictation sit by Send, and
 * the permissions picker gives way to the "Auto-accept edits" toggle.
 */
export function arrangeRevioComposerControls(
  left: readonly NativeChatComposerControl[],
  right: readonly NativeChatComposerControl[]
): { left: NativeChatComposerControl[]; right: NativeChatComposerControl[] } {
  const model = right.filter((control) => control.id === 'model')
  const attach = left.filter((control) => control.id === 'attach')
  return {
    left: [...model, ...left.filter((control) => CHIP_IDS.has(control.id))],
    right: [...attach, ...right.filter((control) => control.id !== 'model')]
  }
}

/**
 * The workspace layout shows context use only above 70% unless "Always show context usage" is on.
 */
export const REVIO_CONTEXT_USAGE_SHOWN_FROM_PERCENT = 70

export function revioShowsContextUsage(percentage: number, alwaysShow: boolean): boolean {
  return alwaysShow || percentage > REVIO_CONTEXT_USAGE_SHOWN_FROM_PERCENT
}
