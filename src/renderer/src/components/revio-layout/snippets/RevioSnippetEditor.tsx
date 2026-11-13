import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  SNIPPET_BODY_MAX,
  SNIPPET_KEYWORD_MAX,
  SNIPPET_NAME_MAX,
  snippetKeyword,
  type RevioPromptSnippet
} from '../../../../../shared/revio-prompt-snippets'

/** The snippet form: Name, Keyword (after `;`) and the Prompt snippet itself. */
export function RevioSnippetEditor({
  snippet,
  error,
  onSave,
  onDelete,
  onCancel
}: {
  snippet: RevioPromptSnippet
  error: string | null
  onSave: (next: RevioPromptSnippet) => void
  onDelete?: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(snippet.name)
  const [keyword, setKeyword] = useState(snippet.keyword)
  const [body, setBody] = useState(snippet.body)
  const canSave = name.trim().length > 0 && body.trim().length > 0
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) {
          onSave({ ...snippet, name: name.trim(), keyword, body })
        }
      }}
    >
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="revio-snippet-name">
            {translate('auto.components.revioLayout.snippets.name', 'Name')}
          </Label>
          <Input
            id="revio-snippet-name"
            value={name}
            maxLength={SNIPPET_NAME_MAX}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex w-36 flex-col gap-2">
          <Label htmlFor="revio-snippet-keyword">
            {translate('auto.components.revioLayout.snippets.keyword', 'Keyword')}
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted-foreground">
              ;
            </span>
            <Input
              id="revio-snippet-keyword"
              data-snippet-keyword
              variant="code"
              adornment="leading"
              value={keyword}
              maxLength={SNIPPET_KEYWORD_MAX}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setKeyword(snippetKeyword(event.target.value))}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="revio-snippet-body">
          {translate('auto.components.revioLayout.snippets.body', 'Prompt snippet')}
        </Label>
        <Textarea
          id="revio-snippet-body"
          value={body}
          maxLength={SNIPPET_BODY_MAX}
          className="h-60 resize-none"
          onChange={(event) => setBody(event.target.value)}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="flex justify-between gap-2">
        {onDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete}>
            {translate('auto.components.revioLayout.snippets.delete', 'Delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {translate('auto.components.revioLayout.snippets.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={!canSave}>
            {translate('auto.components.revioLayout.snippets.save', 'Save')}
          </Button>
        </div>
      </div>
    </form>
  )
}
