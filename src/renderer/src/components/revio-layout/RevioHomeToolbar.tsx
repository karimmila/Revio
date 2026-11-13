import React from 'react'
import { Ellipsis, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ToolbarMenu } from './RevioHomeParts'
import { useRevioHomeHeaderLevel } from './revio-home-header-fit'

// Interactive controls inside the title-row header must opt out of window dragging.
const NO_DRAG = '[-webkit-app-region:no-drag]'

export type RevioHomeToolbarMenu = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  /** Keeps its label one level longer than the other menus. */
  main: boolean
}

/** One of the header's menus, with its typed setter behind the plain-string one the header calls. */
export function revioHomeToolbarMenu<T extends string>(menu: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  main?: boolean
}): RevioHomeToolbarMenu {
  return {
    id: menu.id,
    icon: menu.icon,
    value: menu.value,
    options: menu.options,
    main: menu.main === true,
    onChange: (next) => {
      const match = menu.options.find((option) => option.value === next)
      if (match) {
        menu.onChange(match.value)
      }
    }
  }
}

function MoreMenu({
  menus,
  onClearFilters
}: {
  menus: readonly RevioHomeToolbarMenu[]
  onClearFilters: (() => void) | null
}): React.JSX.Element {
  const label = translate('auto.components.revioLayout.homeMoreControls', 'Filter, sort and display')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-revio-home-more=""
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            NO_DRAG
          )}
        >
          <Ellipsis className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        {menus.map(({ id, icon: Icon, value, options, onChange }) => (
          <DropdownMenuSub key={id}>
            <DropdownMenuSubTrigger>
              <Icon className="size-3.5 text-muted-foreground" />
              {options.find((option) => option.value === value)?.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
                {options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        {onClearFilters ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClearFilters}>
              {translate('auto.components.revioLayout.clearFilters', 'Clear filters')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Home's title row: search, the list's menus and Create. It shows as much as fits its own width
 * (see `useRevioHomeHeaderLevel`): labels, then icons, then one "more" menu, so no control is
 * ever cut off, however narrow the window and however wide the sidebar.
 */
export function RevioHomeToolbar({
  query,
  onQueryChange,
  filtered,
  onClearFilters,
  menus,
  onCreate
}: {
  query: string
  onQueryChange: (query: string) => void
  filtered: boolean
  onClearFilters: () => void
  menus: readonly RevioHomeToolbarMenu[]
  onCreate: () => void
}): React.JSX.Element {
  const headerRef = React.useRef<HTMLElement>(null)
  const contentKey = [
    filtered ? 'filtered' : '',
    ...menus.map((menu) => menu.options.find((option) => option.value === menu.value)?.label)
  ].join('\n')
  const level = useRevioHomeHeaderLevel(headerRef, contentKey)
  const createLabel = translate('auto.components.revioLayout.create', 'Create')
  const iconsOnly = level === 'icons' || level === 'menu'
  return (
    <header
      ref={headerRef}
      data-revio-home-header={level}
      // Size containment: the controls must overflow the header, where the level is measured,
      // and never widen it or the page past the window.
      className="titlebar min-w-0 gap-1.5 bg-background! pr-2 pl-4 [contain:inline-size]"
    >
      <label
        className={cn(
          'flex flex-1 items-center gap-2',
          // The search field keeps room to type in before the menus give up their labels.
          level === 'menu' ? 'min-w-16' : iconsOnly ? 'min-w-24' : 'min-w-40',
          NO_DRAG
        )}
      >
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={translate('auto.components.sidebar.SidebarNav.80611a8b10', 'Search')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {level === 'menu' ? (
        <MoreMenu menus={menus} onClearFilters={filtered ? onClearFilters : null} />
      ) : (
        <>
          {filtered ? (
            <button
              type="button"
              onClick={onClearFilters}
              className={cn(
                'h-6 shrink-0 rounded-md px-1.5 text-[12px] whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-foreground',
                NO_DRAG
              )}
            >
              {translate('auto.components.revioLayout.clearFilters', 'Clear filters')}
            </button>
          ) : null}
          {menus.map((menu) => (
            <ToolbarMenu
              key={menu.id}
              icon={menu.icon}
              hideLabel={iconsOnly || (level === 'main-labels' && !menu.main)}
              value={menu.value}
              onChange={menu.onChange}
              options={menu.options}
            />
          ))}
        </>
      )}
      <button
        type="button"
        onClick={onCreate}
        aria-label={createLabel}
        title={iconsOnly ? createLabel : undefined}
        data-revio-home-create=""
        className={cn(
          'ml-1 flex h-[21px] shrink-0 items-center gap-1 rounded-[5px] bg-foreground px-2 text-[12px] font-medium text-background transition-opacity hover:opacity-90',
          NO_DRAG
        )}
      >
        <Plus className="size-3" strokeWidth={2.25} />
        {iconsOnly ? null : createLabel}
      </button>
    </header>
  )
}
