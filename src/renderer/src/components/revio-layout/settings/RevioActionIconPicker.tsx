import React from 'react'
import { Search } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DEFAULT_ACTION_ICON,
  searchActionIcons,
  type ActionIconId
} from '../../../../../shared/actions/action-icons'
import { ActionIcon } from '../action-icon'

/** "Choose action icon": a searchable grid of icons for the Run button. */
export function RevioActionIconPicker({
  value,
  onChange
}: {
  value: ActionIconId | undefined
  onChange: (icon: ActionIconId) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const current = value ?? DEFAULT_ACTION_ICON
  const matches = searchActionIcons(query)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-revio-icon-button=""
          aria-label={translate(
            'auto.components.revioLayout.settings.chooseActionIcon',
            'Choose action icon'
          )}
        >
          <ActionIcon icon={current} className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="relative border-b border-border p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            autoFocus
            spellCheck={false}
            data-revio-search-input=""
            className="h-7"
            placeholder={translate(
              'auto.components.revioLayout.settings.searchIcons',
              'Search icons'
            )}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto scrollbar-sleek p-2">
          {matches.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              {translate('auto.components.revioLayout.settings.noIcons', 'No icons found')}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {matches.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  title={icon.label}
                  data-revio-icon-choice=""
                  data-selected={icon.id === current ? '' : undefined}
                  aria-label={translate(
                    'auto.components.revioLayout.settings.selectIcon',
                    'Select {{value0}} icon',
                    { value0: icon.label }
                  )}
                  onClick={() => {
                    onChange(icon.id)
                    setOpen(false)
                  }}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground data-[selected]:bg-accent"
                >
                  <ActionIcon icon={icon.id} className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
