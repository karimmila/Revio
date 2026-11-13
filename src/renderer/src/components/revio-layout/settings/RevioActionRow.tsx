import type React from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ACTION_TARGETS,
  type ActionTarget,
  type RepoAction
} from '../../../../../shared/actions/repo-actions'
import { RevioActionIconPicker } from './RevioActionIconPicker'

const TARGET_LABEL: Record<ActionTarget, () => string> = {
  local: () => translate('auto.components.revioLayout.settings.actionLocal', 'This Mac'),
  cloud: () => translate('auto.components.revioLayout.settings.actionCloud', 'Cloud workspace'),
  mirror: () => translate('auto.components.revioLayout.settings.actionMirror', 'Local mirror')
}

/** One action: name, script and where it can run (checkboxes). */
export function RevioActionRow({
  action,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  hidden,
  onToggleHidden
}: {
  action: RepoAction
  first: boolean
  last: boolean
  onChange: (next: RepoAction) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  /** Hidden from the Run menu (Hide action). */
  hidden: boolean
  onToggleHidden: () => void
}): React.JSX.Element {
  const toggle = (target: ActionTarget): void =>
    onChange({
      ...action,
      targets: action.targets.includes(target)
        ? action.targets.filter((entry) => entry !== target)
        : ACTION_TARGETS.filter((entry) => entry === target || action.targets.includes(entry))
    })
  return (
    <div
      data-revio-action-row=""
      className="flex flex-col gap-2 rounded-md border border-border p-2.5"
    >
      <div className="flex items-center gap-2">
        <RevioActionIconPicker
          value={action.icon}
          onChange={(icon) => onChange({ ...action, icon })}
        />
        <Input
          value={action.name}
          aria-label={translate('auto.components.revioLayout.settings.actionName', 'Action name')}
          className="h-7 flex-1"
          onChange={(event) => onChange({ ...action, name: event.target.value })}
        />
        <button
          type="button"
          data-revio-icon-button=""
          disabled={first}
          aria-label={translate('auto.components.revioLayout.settings.moveUp', 'Move up')}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          data-revio-icon-button=""
          disabled={last}
          aria-label={translate('auto.components.revioLayout.settings.moveDown', 'Move down')}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" />
        </button>
        <button
          type="button"
          data-revio-icon-button=""
          aria-pressed={hidden}
          aria-label={
            hidden
              ? translate('auto.components.revioLayout.settings.showAction', 'Show action')
              : translate('auto.components.revioLayout.settings.hideAction', 'Hide action')
          }
          title={
            hidden
              ? translate('auto.components.revioLayout.settings.showAction', 'Show action')
              : translate('auto.components.revioLayout.settings.hideAction', 'Hide action')
          }
          onClick={onToggleHidden}
        >
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
      <Textarea
        value={action.script}
        rows={4}
        spellCheck={false}
        variant="code"
        aria-label={translate('auto.components.revioLayout.settings.actionScript', 'Script')}
        onChange={(event) => onChange({ ...action, script: event.target.value })}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span>{translate('auto.components.revioLayout.settings.canRunIn', 'Can run in')}</span>
        {ACTION_TARGETS.map((target) => (
          <label key={target} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={action.targets.includes(target)}
              onChange={() => toggle(target)}
            />
            {TARGET_LABEL[target]()}
          </label>
        ))}
      </div>
    </div>
  )
}
