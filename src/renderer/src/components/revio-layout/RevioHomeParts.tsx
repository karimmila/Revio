import type React from 'react'
import { ChevronDown, FolderOpen, Globe, Rocket } from 'lucide-react'
import { useAppStore } from '@/store'
import { useRecentProjects } from './revio-recent-projects'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ProductBlockWordmark } from './ProductBlockWordmark'

// Interactive controls inside the title-row header must opt out of window dragging.
const NO_DRAG = '[-webkit-app-region:no-drag]'

export function ToolbarMenu<T extends string>({
  icon: Icon,
  value,
  options,
  onChange,
  hideLabel = false
}: {
  icon: React.ComponentType<{ className?: string }>
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  hideLabel?: boolean
}): React.JSX.Element {
  const current = options.find((option) => option.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // With its label hidden the control still says what it is set to.
          aria-label={hideLabel ? current?.label : undefined}
          title={hideLabel ? current?.label : undefined}
          className={cn(
            'flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            NO_DRAG
          )}
        >
          <Icon className="size-3.5" />
          {hideLabel ? null : <span className="whitespace-nowrap">{current?.label}</span>}
          <ChevronDown className="size-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next)
            if (match) {
              onChange(match.value)
            }
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EmptyHome(): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const recents = useRecentProjects()
  const cards = [
    {
      icon: FolderOpen,
      label: translate('auto.components.revioLayout.openProject', 'Open project'),
      // The Open project goes straight to the folder picker.
      onPress: () => void useAppStore.getState().addRepo()
    },
    {
      icon: Globe,
      label: translate('auto.components.revioLayout.openGitHubProject', 'Open GitHub project'),
      onPress: () => openModal('add-repo', { startStep: 'clone' })
    },
    {
      icon: Rocket,
      label: translate('auto.components.revioLayout.quickStart', 'Quick start'),
      // The Quick start makes a new project: a template and, if asked, a GitHub repo.
      onPress: () => openModal('add-repo', { startStep: 'create' })
    }
  ]
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-16">
      <ProductBlockWordmark className="h-20 w-auto text-foreground" />
      <div className="grid w-full max-w-[540px] grid-cols-3 gap-2.5">
        <p className="col-span-3 pb-2 text-center text-[13px] text-muted-foreground">
          {translate('auto.components.revioLayout.addProjectToStart', 'Add a project to start')}
        </p>
        {cards.map(({ icon: Icon, label, onPress }) => (
          <button
            key={label}
            type="button"
            onClick={onPress}
            className="flex h-[108px] flex-col justify-between rounded-lg border border-border bg-card p-3.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-accent/50"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {recents.length > 0 ? (
        <div data-revio-recents="" className="w-full max-w-[540px]">
          <div data-revio-recents-title="">
            {translate('auto.components.revioLayout.recents', 'Recents')}
          </div>
          {recents.map((recent) => (
            <button
              key={recent.path}
              type="button"
              title={recent.path}
              onClick={() => void useAppStore.getState().addRepoPath(recent.path)}
            >
              <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{recent.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
