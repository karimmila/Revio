import type { editor } from 'monaco-editor'
import { revioLayoutActive } from './revio-root-flags'

/**
 * The cleaner diff: no +/- glyphs (the green bar and tint already say it), no overview
 * ruler, and unchanged runs folded into "N unmodified lines" bars unless "Entire file" is on.
 * Empty outside the layout.
 */
export function revioDiffEditorOptions(entireFile = false): editor.IDiffEditorConstructionOptions {
  if (!revioLayoutActive()) {
    return {}
  }
  return {
    renderIndicators: false,
    renderOverviewRuler: false,
    renderMarginRevertIcon: false,
    renderGutterMenu: false,
    renderLineHighlight: 'none',
    // The workspace layout keeps both sides even in a narrow center pane.
    useInlineViewWhenSpaceIsLimited: false,
    hideUnchangedRegions: {
      enabled: !entireFile,
      contextLineCount: 3,
      minimumLineCount: 6,
      revealLineCount: 20
    }
  }
}

/**
 * Whether a file's diff is drawn side by side. A file that was added or deleted has one empty
 * side: side by side that is an empty half and the code cut off in the other, so the workspace
 * layout shows such a file inline whatever the view is set to.
 */
export function revioDiffSideBySide(
  sideBySide: boolean,
  originalContent: string,
  modifiedContent: string
): boolean {
  if (!sideBySide || !revioLayoutActive()) {
    return sideBySide
  }
  return originalContent !== '' && modifiedContent !== ''
}
