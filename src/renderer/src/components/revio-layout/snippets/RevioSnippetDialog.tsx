import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  filterSnippets,
  saveSnippet,
  type RevioPromptSnippet
} from '../../../../../shared/revio-prompt-snippets'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/non-secure-context-uuid'
import { RevioSnippetEditor } from './RevioSnippetEditor'
import { REVIO_INSERT_SNIPPET_EVENT, insertIntoChatInput } from './revio-snippet-insert'

const EMPTY: readonly RevioPromptSnippet[] = []

/** ⌘; "Insert snippet": search, pick to insert into the chat input, or create one. */
export function RevioSnippetDialog(): React.JSX.Element {
  const snippets = useAppStore((s) => s.settings?.revioPromptSnippets ?? EMPTY)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState<RevioPromptSnippet | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const open = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail instanceof HTMLElement) {
        setTarget(event.detail)
        setQuery('')
        setActive(0)
        setEditing(null)
      }
    }
    window.addEventListener(REVIO_INSERT_SNIPPET_EVENT, open)
    return () => window.removeEventListener(REVIO_INSERT_SNIPPET_EVENT, open)
  }, [])
  const shown = filterSnippets(snippets, query)
  const close = (): void => setTarget(null)
  const pick = (snippet: RevioPromptSnippet | undefined): void => {
    if (snippet && target) {
      close()
      // After the dialog hands focus back, so the insertion lands in the chat input.
      requestAnimationFrame(() => insertIntoChatInput(target, snippet.body))
    }
  }
  const save = (next: RevioPromptSnippet): void => {
    const saved = saveSnippet(snippets, next)
    if (saved === 'keyword-taken') {
      setError(
        translate(
          'auto.components.revioLayout.snippets.keywordTaken',
          'Another snippet uses this keyword.'
        )
      )
      return
    }
    void useAppStore.getState().updateSettings({ revioPromptSnippets: saved })
    setEditing(null)
    setError(null)
  }
  const remove = (id: string): void => {
    void useAppStore.getState().updateSettings({
      revioPromptSnippets: snippets.filter((snippet) => snippet.id !== id)
    })
    setEditing(null)
  }
  const title = editing
    ? translate('auto.components.revioLayout.snippets.create', 'Create snippet')
    : translate('auto.components.revioLayout.snippets.insert', 'Insert snippet')
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>{title}</DialogTitle>
        {editing ? (
          <RevioSnippetEditor
            key={editing.id}
            snippet={editing}
            error={error}
            onSave={save}
            onCancel={() => setEditing(null)}
            onDelete={
              snippets.some((snippet) => snippet.id === editing.id)
                ? () => remove(editing.id)
                : undefined
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <Input
              autoFocus
              value={query}
              placeholder={translate(
                'auto.components.revioLayout.snippets.search',
                'Search snippets...'
              )}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const step = event.key === 'ArrowDown' ? 1 : -1
                  setActive((index) => Math.max(0, Math.min(shown.length - 1, index + step)))
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  pick(shown[active])
                }
              }}
            />
            <ul role="listbox" className="scrollbar-sleek flex max-h-72 flex-col overflow-y-auto">
              {shown.map((snippet, index) => (
                <li
                  key={snippet.id}
                  role="option"
                  aria-selected={index === active}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(snippet)}
                >
                  <span className="min-w-0 flex-1 truncate">{snippet.name}</span>
                  {snippet.keyword ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      ;{snippet.keyword}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={translate(
                      'auto.components.revioLayout.snippets.edit',
                      'Edit snippet'
                    )}
                    onClick={(event) => {
                      event.stopPropagation()
                      setEditing(snippet)
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() =>
                setEditing({ id: createBrowserUuid(), name: '', keyword: '', body: '' })
              }
            >
              <Plus className="size-3.5" />
              {translate('auto.components.revioLayout.snippets.create', 'Create snippet')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
