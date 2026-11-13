import React from 'react'
import { Cloud, Eye, EyeOff, SquareTerminal, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  isReservedVariableKey,
  isValidVariableKey,
  type WorkspaceVariable
} from '../../../../../shared/workspace-variables/dotenv'

/** One variable: its name, its value (hidden until revealed), whether it may go to the cloud. */
export function RevioVariableRow({
  variable,
  onChange,
  onRemove
}: {
  variable: WorkspaceVariable
  onChange: (next: WorkspaceVariable) => void
  onRemove: () => void
}): React.JSX.Element {
  const [key, setKey] = React.useState(variable.key)
  const [value, setValue] = React.useState(variable.value)
  const [revealed, setRevealed] = React.useState(false)
  React.useEffect(() => setValue(variable.value), [variable.value])
  React.useEffect(() => setKey(variable.key), [variable.key])
  const keyProblem = !isValidVariableKey(key)
    ? translate('auto.components.revioLayout.settings.envBadName', 'Letters, digits and _ only')
    : isReservedVariableKey(key)
      ? translate(
          'auto.components.revioLayout.settings.envReserved',
          '{{productName}} never sets this one'
        )
      : null
  const commit = (): void => {
    if (!keyProblem && (key !== variable.key || value !== variable.value)) {
      onChange({ ...variable, key, value })
    }
  }
  return (
    <div data-revio-variable-row="">
      <Input
        value={key}
        variant="code"
        spellCheck={false}
        aria-label={translate('auto.components.revioLayout.settings.envName', 'Name')}
        aria-invalid={keyProblem ? true : undefined}
        title={keyProblem ?? undefined}
        onChange={(event) => setKey(event.target.value.trim())}
        onBlur={commit}
      />
      <Input
        value={value}
        variant="code"
        spellCheck={false}
        type={revealed ? 'text' : 'password'}
        autoComplete="off"
        aria-label={translate('auto.components.revioLayout.settings.envValue', 'Value')}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
      />
      <button
        type="button"
        data-revio-icon-button=""
        aria-label={
          revealed
            ? translate('auto.components.revioLayout.settings.envHide', 'Hide value')
            : translate('auto.components.revioLayout.settings.envShow', 'Show value')
        }
        onClick={() => setRevealed((open) => !open)}
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        type="button"
        data-revio-icon-button=""
        data-active={variable.sendToCloud ? 'true' : undefined}
        aria-pressed={variable.sendToCloud}
        title={
          variable.sendToCloud
            ? translate(
                'auto.components.revioLayout.settings.envCloudOn',
                'Sent to cloud workspaces'
              )
            : translate('auto.components.revioLayout.settings.envCloudOff', 'Stays on this Mac')
        }
        onClick={() =>
          onChange({
            ...variable,
            sendToCloud: !variable.sendToCloud,
            cloudEnvironment: variable.sendToCloud ? false : variable.cloudEnvironment
          })
        }
      >
        <Cloud className="size-3.5" />
      </button>
      <button
        type="button"
        data-revio-icon-button=""
        data-active={variable.sendToCloud && variable.cloudEnvironment ? 'true' : undefined}
        aria-pressed={variable.sendToCloud && variable.cloudEnvironment === true}
        disabled={!variable.sendToCloud}
        title={
          variable.sendToCloud && variable.cloudEnvironment
            ? translate(
                'auto.components.revioLayout.settings.envCloudShellOn',
                'Every shell and agent in the sandbox sees it'
              )
            : translate(
                'auto.components.revioLayout.settings.envCloudShellOff',
                'Only the sandbox’s setup, wake and Run scripts see it'
              )
        }
        onClick={() => onChange({ ...variable, cloudEnvironment: !variable.cloudEnvironment })}
      >
        <SquareTerminal className="size-3.5" />
      </button>
      <button
        type="button"
        data-revio-icon-button=""
        aria-label={translate('auto.components.revioLayout.settings.envRemove', 'Remove')}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
