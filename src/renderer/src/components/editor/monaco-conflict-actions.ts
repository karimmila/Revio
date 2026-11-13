import type { editor } from 'monaco-editor'
import { translate } from '@/i18n/i18n'
import { findGitConflictBlocks } from './monaco-conflict-decorations'

export type ConflictChoice = 'current' | 'incoming' | 'both'

/** The text that replaces conflict block `index` (its marker lines included) for a choice. */
export function conflictReplacement(
  content: string,
  index: number,
  choice: ConflictChoice
): { startLine: number; endLine: number; text: string } | null {
  const block = findGitConflictBlocks(content)[index]
  if (!block) {
    return null
  }
  const lines = content.split(/\r?\n/)
  // Line numbers are 1-based; slice end is exclusive.
  const current = lines.slice(block.startLine, (block.baseLine ?? block.separatorLine) - 1)
  const incoming = lines.slice(block.separatorLine, block.endLine - 1)
  const kept =
    choice === 'current' ? current : choice === 'incoming' ? incoming : [...current, ...incoming]
  return { startLine: block.startLine, endLine: block.endLine, text: kept.join('\n') }
}

function choiceLabel(choice: ConflictChoice): string {
  if (choice === 'current') {
    return translate(
      'auto.components.editor.conflictActions.acceptCurrent',
      'Accept current change'
    )
  }
  if (choice === 'incoming') {
    return translate(
      'auto.components.editor.conflictActions.acceptIncoming',
      'Accept incoming change'
    )
  }
  return translate('auto.components.editor.conflictActions.acceptBoth', 'Accept both')
}

function applyChoice(ed: editor.ICodeEditor, index: number, choice: ConflictChoice): void {
  const model = ed.getModel()
  const replacement = model ? conflictReplacement(model.getValue(), index, choice) : null
  if (!model || !replacement) {
    return
  }
  const { startLine, endLine, text } = replacement
  // Removing the block's last line also takes its line break, unless nothing is kept.
  const range =
    text === '' && endLine < model.getLineCount()
      ? { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine + 1, endColumn: 1 }
      : {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: model.getLineMaxColumn(endLine)
        }
  ed.executeEdits('revio-conflict-actions', [{ range, text }])
  ed.pushUndoStop()
}

function actionBar(ed: editor.ICodeEditor, index: number): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'orca-conflict-actions'
  for (const choice of ['current', 'incoming', 'both'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = choiceLabel(choice)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => applyChoice(ed, index, choice))
    bar.appendChild(button)
  }
  return bar
}

/**
 * Accept current / incoming / both above each conflict block, as the workspace layout shows them.
 * Rebuilds on every content change; returns a dispose function.
 */
export function installConflictActions(ed: editor.ICodeEditor): () => void {
  let zoneIds: string[] = []
  let frame = 0
  const rebuild = (): void => {
    const blocks = findGitConflictBlocks(ed.getModel()?.getValue() ?? '')
    ed.changeViewZones((accessor) => {
      for (const id of zoneIds) {
        accessor.removeZone(id)
      }
      zoneIds = blocks.map((block, index) =>
        accessor.addZone({
          afterLineNumber: block.startLine - 1,
          heightInPx: 22,
          domNode: actionBar(ed, index)
        })
      )
    })
  }
  const schedule = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(rebuild)
  }
  rebuild()
  const contentSub = ed.onDidChangeModelContent(schedule)
  const modelSub = ed.onDidChangeModel(schedule)
  return () => {
    cancelAnimationFrame(frame)
    contentSub.dispose()
    modelSub.dispose()
    ed.changeViewZones((accessor) => {
      for (const id of zoneIds) {
        accessor.removeZone(id)
      }
    })
    zoneIds = []
  }
}
