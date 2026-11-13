import React from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import {
  parseFilesToCopy,
  type WorktreeIncludePreview
} from '../../../../../shared/worktree-include-preview'
import type { Repo } from '../../../../../shared/repo-types'
import { RevioSettingRow } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { filesToCopyText, withFilesToCopy } from './revio-files-to-copy'

const PREVIEW_DEBOUNCE_MS = 300
const PREVIEW_LIMIT = 100
const PLACEHOLDER = '.env\n*.local'

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; preview: WorktreeIncludePreview }

/** Reads the preview for `text` after typing pauses; `refresh` reads it again now. */
function useFilesToCopyPreview(
  repoId: string,
  text: string
): { state: PreviewState; refresh: () => void } {
  const [state, setState] = React.useState<PreviewState>({ kind: 'loading' })
  const [nonce, setNonce] = React.useState(0)
  React.useEffect(() => {
    let live = true
    setState({ kind: 'loading' })
    const timer = window.setTimeout(() => {
      const api = window.api.repoActions
      if (!api) {
        setState({ kind: 'error' })
        return
      }
      api
        .filesToCopyPreview(repoId, parseFilesToCopy(text))
        .then((preview) => live && setState({ kind: 'ready', preview }))
        .catch(() => live && setState({ kind: 'error' }))
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [repoId, text, nonce])
  return { state, refresh: () => setNonce((value) => value + 1) }
}

function PreviewList({
  state,
  refresh,
  repoPath
}: {
  state: PreviewState
  refresh: () => void
  repoPath: string
}): React.JSX.Element {
  const files = state.kind === 'ready' ? state.preview.files : []
  const summary =
    state.kind === 'loading'
      ? translate(
          'auto.components.revioLayout.settings.filesToCopyLoading',
          'Detecting files to copy...'
        )
      : state.kind === 'error'
        ? translate(
            'auto.components.revioLayout.settings.filesToCopyError',
            'Could not preview files to copy.'
          )
        : files.length === 0
          ? translate(
              'auto.components.revioLayout.settings.filesToCopyNone',
              'No matching gitignored files found.'
            )
          : translate(
              'auto.components.revioLayout.settings.filesToCopyCount',
              '{{value0}} files will be copied from {{value1}}',
              {
                value0: files.length,
                value1: repoPath,
                count: files.length,
                defaultValue_one: '{{value0}} file will be copied from {{value1}}'
              }
            )
  const hidden = files.length - PREVIEW_LIMIT
  return (
    <div className="flex w-full flex-col gap-1.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{summary}</span>
        <button
          type="button"
          aria-label={translate(
            'auto.components.revioLayout.settings.filesToCopyRefresh',
            'Refresh files to copy preview'
          )}
          disabled={state.kind === 'loading'}
          onClick={refresh}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
        >
          <RefreshCw className={`size-3 ${state.kind === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {files.length > 0 ? (
        <div className="scrollbar-sleek max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono">
          {files.slice(0, PREVIEW_LIMIT).map((file) => (
            <div key={file} className="truncate">
              {file}
            </div>
          ))}
          {hidden > 0 ? (
            <div>
              {translate(
                'auto.components.revioLayout.settings.filesToCopyMore',
                'and {{value0}} more',
                { value0: hidden }
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FilesToCopyEditor({ repo }: { repo: Repo }): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const savedText = filesToCopyText(settings.revioFileIncludeGlobs, repo.id)
  const [draft, setDraft] = React.useState(savedText)
  const { state, refresh } = useFilesToCopyPreview(repo.id, draft)
  const fromFile = state.kind === 'ready' && state.preview.source === 'worktreeinclude'
  const save = (): void => {
    update({
      revioFileIncludeGlobs: withFilesToCopy(settings.revioFileIncludeGlobs, repo.id, draft)
    })
    toast.success(
      translate('auto.components.revioLayout.settings.filesToCopySaved', 'Files to copy saved')
    )
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="relative w-full">
        <Textarea
          value={fromFile ? (state.preview.contents ?? '') : draft}
          rows={5}
          spellCheck={false}
          readOnly={fromFile}
          disabled={fromFile}
          placeholder={PLACEHOLDER}
          aria-label={translate(
            'auto.components.revioLayout.settings.filesToCopy',
            'Files to copy'
          )}
          onChange={(event) => setDraft(event.target.value)}
          variant="code"
        />
        {fromFile ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-muted/80 px-4 text-center text-xs text-muted-foreground">
            {translate(
              'auto.components.revioLayout.settings.filesToCopyFromFile',
              'Using .worktreeinclude from this repository. Remove that file to edit these patterns here.'
            )}
          </div>
        ) : null}
      </div>
      <PreviewList state={state} refresh={refresh} repoPath={repo.path} />
      {fromFile ? null : (
        <button
          type="button"
          data-revio-settings-button=""
          disabled={draft === savedText}
          onClick={save}
        >
          {translate('auto.components.revioLayout.settings.saveFilesToCopy', 'Save files to copy')}
        </button>
      )}
    </div>
  )
}

/** "Files to copy": gitignored files each new workspace gets, with a live preview. */
export function RevioFilesToCopyRow({ repo }: { repo: Repo }): React.JSX.Element {
  const local = getRepoExecutionHostId(repo) === 'local'
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.filesToCopy', 'Files to copy')}
      description={translate(
        'auto.components.revioLayout.settings.filesToCopyDescription',
        '{{productName}} will automatically copy these file paths in each new workspace.'
      )}
      below={
        local ? (
          <FilesToCopyEditor key={repo.id} repo={repo} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.revioLayout.settings.filesToCopyUnavailable',
              'Files to copy is unavailable until this repository has a linked local checkout.'
            )}
          </p>
        )
      }
    />
  )
}
