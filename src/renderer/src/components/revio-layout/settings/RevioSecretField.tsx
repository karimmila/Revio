import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type {
  AgentCredentialName,
  AgentCredentialStatus
} from '../../../../../shared/agent-credentials-types'

/** Which sealed secrets exist; the renderer only ever learns yes or no. */
export function useAgentCredentialStatus(): [
  AgentCredentialStatus | null,
  (next: AgentCredentialStatus) => void
] {
  const [status, setStatus] = React.useState<AgentCredentialStatus | null>(null)
  React.useEffect(() => {
    void window.api.agentCredentials
      ?.status()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])
  return [status, setStatus]
}

/** A write-only secret: type it and Save; Remove clears it. The stored value is never shown. */
export function RevioSecretField({
  name,
  label,
  placeholder,
  status,
  onStatus
}: {
  name: AgentCredentialName
  label: string
  placeholder: string
  status: AgentCredentialStatus | null
  onStatus: (next: AgentCredentialStatus) => void
}): React.JSX.Element {
  const [draft, setDraft] = React.useState('')
  const api = window.api.agentCredentials
  const save = async (value: string): Promise<void> => {
    if (!api) {
      return
    }
    try {
      onStatus(await api.set(name, value))
      setDraft('')
    } catch (error) {
      toast.error(
        translate('auto.components.revioLayout.settings.secretFailed', 'Could not save.'),
        { description: extractIpcErrorMessage(error, '') || undefined }
      )
    }
  }
  const stored = status?.[name] === true
  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        value={draft}
        autoComplete="off"
        spellCheck={false}
        placeholder={
          stored
            ? translate('auto.components.revioLayout.settings.secretStored', 'Saved on this Mac')
            : placeholder
        }
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && draft.trim()) {
            void save(draft)
          }
        }}
        variant="code"
        className="h-8 w-56"
      />
      {draft.trim() ? (
        <button type="button" data-revio-settings-button="" onClick={() => void save(draft)}>
          {translate('auto.components.revioLayout.settings.save', 'Save')}
        </button>
      ) : stored ? (
        <button type="button" data-revio-settings-button="" onClick={() => void save('')}>
          {translate('auto.components.revioLayout.settings.remove', 'Remove')}
        </button>
      ) : null}
    </div>
  )
}
