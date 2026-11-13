import React from 'react'
import { forgeRepoTarget } from '@/lib/cloud-forge-repo'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Textarea } from '@/components/ui/textarea'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import { revioLayoutActive } from './revio-root-flags'

/**
 * The inline PR description edit in the Checks tab (the title already edits in place
 * above). Reads the body from GitHub on open, saves it with one PATCH. Desktop GitHub repos only.
 */
export function RevioPrDescription({
  repo,
  pr
}: {
  repo: Pick<Repo, 'id' | 'path' | 'connectionId' | 'executionHostId'> | null
  pr: Pick<PRInfo, 'number' | 'prRepo'> | null
}): React.JSX.Element | null {
  const [body, setBody] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const number = pr?.number
  const prRepo = pr?.prRepo ?? null
  const active = revioLayoutActive() && repo !== null && number !== undefined
  React.useEffect(() => {
    if (!active || !repo || number === undefined) {
      return
    }
    let live = true
    void window.api.gh
      .prBody({ ...forgeRepoTarget(repo), prNumber: number, prRepo })
      .catch(() => null)
      .then((next) => {
        if (live) {
          setBody(next)
        }
      })
    return () => {
      live = false
    }
  }, [active, repo, number, prRepo])
  if (!active || !repo || number === undefined || body === null) {
    return null
  }
  const save = async (next: string): Promise<void> => {
    setSaving(true)
    const failed = (error: unknown): { ok: false; error: string } => ({
      ok: false,
      error: String(error)
    })
    const result = await window.api.gh
      .updatePRBody({ ...forgeRepoTarget(repo), prNumber: number, body: next, prRepo })
      .catch(failed)
    setSaving(false)
    if (result.ok) {
      setBody(next)
      setDraft(null)
    } else {
      toast.error(result.error)
    }
  }
  return (
    <section data-revio-pr-description="" className="border-t border-border px-3 py-2">
      <div className="flex h-6 items-center justify-between text-[12px] font-medium text-muted-foreground">
        {translate('auto.components.revioLayout.prDescription', 'Description')}
        {draft === null ? (
          <button
            type="button"
            data-revio-icon-button=""
            aria-label={translate(
              'auto.components.revioLayout.editDescription',
              'Edit description'
            )}
            onClick={() => setDraft(body)}
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
      </div>
      {draft === null ? (
        body.trim() ? (
          <CommentMarkdown
            content={body}
            className="min-w-0 max-w-full break-words text-[12.5px] text-foreground/90 [&_a]:break-all [&_pre]:max-w-full"
          />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            {translate('auto.components.revioLayout.noDescription', 'No description provided.')}
          </p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            rows={8}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" data-revio-settings-text-button="" onClick={() => setDraft(null)}>
              {translate('auto.components.revioLayout.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              data-revio-settings-button=""
              disabled={saving || draft === body}
              onClick={() => void save(draft)}
            >
              {translate('auto.components.revioLayout.save', 'Save')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
