import type React from 'react'
import { translate } from '@/i18n/i18n'
import { splitDiffCommentSuggestions } from './diff-comment-suggestion'

/** A note's text, with GitHub suggestion blocks shown as a "Suggested change". */
export function DiffCommentBody({
  body,
  suggestionBase
}: {
  body: string
  /** The lines the suggestion replaces; shown as the removed side when known. */
  suggestionBase?: string
}): React.JSX.Element {
  const parts = splitDiffCommentSuggestions(body)
  return (
    <div className="orca-diff-comment-body">
      {parts.map((part) =>
        part.kind === 'text' ? (
          <div key={part.offset}>{part.text}</div>
        ) : (
          <div key={part.offset} className="orca-diff-comment-suggestion">
            <div className="orca-diff-comment-suggestion-title">
              {translate('auto.components.diff.comments.suggestedChange', 'Suggested change')}
            </div>
            {suggestionBase !== undefined ? (
              <pre className="orca-diff-comment-suggestion-code" data-side="old">
                {suggestionBase}
              </pre>
            ) : null}
            <pre className="orca-diff-comment-suggestion-code" data-side="new">
              {part.lines.length === 0 ? '\n' : part.lines.join('\n')}
            </pre>
          </div>
        )
      )}
    </div>
  )
}
