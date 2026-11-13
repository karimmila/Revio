import React from 'react'
import {
  ArrowLeft,
  Bot,
  CircleUser,
  Cloud,
  Download,
  Cpu,
  FlaskConical,
  FolderGit2,
  GitBranch,
  Keyboard,
  KeyRound,
  MessageSquareText,
  Plug,
  Palette,
  Search,
  Smartphone,
  SlidersHorizontal,
  Wrench
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useImportSourceAvailable } from '../../workspace-import/use-import-source-available'
import { translate } from '@/i18n/i18n'
import { isGitRepoKind } from '../../../../../shared/repo-kind'
import { isForkServiceEnabled } from '../../../../../shared/fork-services'
import { isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import {
  openRevioSettingsPage,
  useRevioSettingsView,
  type RevioSettingsPageId
} from './revio-settings-view'
import { RevioSettingsPageContent } from './RevioSettingsPageContent'

type NavItem = {
  id: RevioSettingsPageId
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Words from the page's rows, so the search box finds a page by what it holds. */
  keywords: string
}

function navGroups(
  repos: readonly { id: string; displayName: string }[],
  showImport: boolean
): {
  title: string
  items: NavItem[]
}[] {
  return [
    {
      title: translate('auto.components.revioLayout.settings.personal', 'Personal'),
      items: [
        {
          id: 'general',
          label: translate('auto.components.revioLayout.settings.general', 'General'),
          icon: SlidersHorizontal,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords1',
            'send enter follow-up steer queue notifications sound disk arrange paste caffeinate sleep update artifacts tool calls skills sync'
          )
        },
        {
          id: 'account',
          label: translate('auto.components.revioLayout.settings.account', 'Account'),
          icon: CircleUser,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords2',
            'name machine github linear'
          )
        },
        {
          id: 'appearance',
          label: translate('auto.components.revioLayout.settings.appearance', 'Appearance'),
          icon: Palette,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords3',
            'theme dark light zoom font mono ligatures markdown terminal code'
          )
        },
        {
          id: 'shortcuts',
          label: translate('auto.components.revioLayout.settings.shortcuts', 'Keyboard shortcuts'),
          icon: Keyboard,
          keywords: translate(
            'auto.components.revioLayout.settings.keywordsShortcuts',
            'keyboard shortcut keybinding key bind hotkey rebind reset'
          )
        },
        {
          id: 'models',
          label: translate('auto.components.revioLayout.settings.models', 'Default models'),
          icon: Cpu,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords4',
            'model effort claude codex cursor default'
          )
        },
        {
          id: 'git',
          label: translate('auto.components.revioLayout.settings.git', 'Git'),
          icon: GitBranch,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords5',
            'branch prefix rename archive delete pull request upstream push stacked stack'
          )
        }
      ]
    },
    {
      title: translate('auto.components.revioLayout.settings.agentsGroup', 'Agents & environment'),
      items: [
        {
          id: 'agents',
          label: translate('auto.components.revioLayout.settings.agents', 'Agents'),
          icon: Bot,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords6',
            'claude codex cursor sign in connect subscription account'
          )
        },
        {
          id: 'prompts',
          label: translate('auto.components.revioLayout.settings.prompts', 'Prompts'),
          icon: MessageSquareText,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords7',
            'review create pr fix errors resolve conflicts commit message prompt'
          )
        },
        {
          id: 'mcp',
          label: translate('auto.components.revioLayout.settings.mcpServers', 'MCP servers'),
          icon: Plug,
          keywords: translate(
            'auto.components.revioLayout.settings.keywordsMcp',
            'mcp server servers tools context7 linear import recommended sync skills slash commands agent configs'
          )
        },
        {
          id: 'environment',
          label: translate('auto.components.revioLayout.settings.environment', 'Environment'),
          icon: KeyRound,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords8',
            'environment variables env import'
          )
        },
        {
          id: 'cloud',
          label: translate('auto.components.revioLayout.settings.cloud', 'Cloud'),
          icon: Cloud,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords12',
            'vercel sandbox cloud workspace remote connect team plan'
          )
        }
      ]
    },
    {
      title: translate('auto.components.revioLayout.settings.repositories', 'Repositories'),
      items: repos.map((repo) => ({
        id: `repo:${repo.id}` as const,
        label: repo.displayName,
        icon: FolderGit2,
        keywords: translate(
          'auto.components.revioLayout.settings.keywords9',
          'default branch setup archive script repository mcp servers icon path remove'
        )
      }))
    },
    {
      title: translate('auto.components.revioLayout.settings.more', 'More'),
      items: [
        {
          id: 'experimental',
          label: translate('auto.components.revioLayout.settings.experimental', 'Experimental'),
          icon: FlaskConical,
          keywords: translate(
            'auto.components.revioLayout.settings.keywords10',
            'permission auto dashboard voice dictation sidebar transparency remote mobile'
          )
        },
        ...(isForkServiceEnabled('relayBaseUrl')
          ? [
              {
                id: 'remote' as const,
                label: translate(
                  'auto.components.revioLayout.settings.remoteControl',
                  'Remote control'
                ),
                icon: Smartphone,
                keywords: translate(
                  'auto.components.revioLayout.settings.keywordsRemote',
                  'remote control phone mobile pair device iphone'
                )
              }
            ]
          : []),
        ...(showImport
          ? [
              {
                id: 'import' as const,
                label: translate('components.workspaceImport.settingsPage', 'Import'),
                icon: Download,
                keywords: translate(
                  'components.workspaceImport.settingsKeywords',
                  'import workspaces chats move migrate'
                )
              }
            ]
          : []),
        {
          id: 'advanced',
          label: translate('auto.components.revioLayout.settings.advanced', 'Advanced'),
          icon: Wrench,
          keywords: translate(
            'auto.components.revioLayout.settings.keywordsAdvanced',
            'root directory workspaces folder executable path claude codex opencode scrollback diagnostics logs'
          )
        }
      ]
    }
  ]
}

function matches(item: NavItem, query: string): boolean {
  const haystack = `${item.label} ${item.keywords}`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

/**
 * The settings: a short menu of pages whose rows write Orca's own settings, so this page
 * and Orca's full settings always agree. "All Orca settings" opens the full page.
 */
export default function RevioSettings(): React.JSX.Element {
  const { page } = useRevioSettingsView()
  const closeSettingsPage = useAppStore((s) => s.closeSettingsPage)
  const repos = useAppStore((s) => s.repos)
  const [query, setQuery] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  // A cloud workspace's own repository copy is temporary; its settings live on the source repository.
  const gitRepos = React.useMemo(
    () => repos.filter((repo) => isGitRepoKind(repo) && !isCloudRepo(repo, cloudEnvironmentIds)),
    [cloudEnvironmentIds, repos]
  )
  const groups = navGroups(gitRepos, useImportSourceAvailable())
    .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, query)) }))
    .filter((group) => group.items.length > 0)

  // In a narrow window the pages are one horizontal strip; keep the open one in view.
  React.useEffect(() => {
    const reveal = (): void =>
      listRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [page])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      // Esc leaves settings. Open menus and dialogs keep it, and the shortcut
      // recorder marks its own Esc handled.
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
      ) {
        closeSettingsPage()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeSettingsPage])

  return (
    <div data-revio-settings="" className="flex h-full min-h-0 w-full">
      <nav data-revio-settings-nav="" className="flex min-h-0 flex-col">
        <button type="button" data-revio-settings-back="" onClick={closeSettingsPage}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.revioLayout.settings.back', 'Back')}
        </button>
        <label data-revio-settings-search="">
          <Search className="size-3.5" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate(
              'auto.components.revioLayout.settings.search',
              'Search settings'
            )}
          />
          <kbd>{translate('auto.components.revioLayout.settings.searchShortcut', '⌘F')}</kbd>
        </label>
        <div
          ref={listRef}
          data-revio-settings-nav-list=""
          className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto"
        >
          {groups.map((group) => (
            <div key={group.title} data-revio-settings-nav-group="">
              <div data-revio-settings-nav-title="">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-revio-settings-nav-item=""
                    data-active={item.id === page ? 'true' : undefined}
                    onClick={() => openRevioSettingsPage(item.id)}
                  >
                    <Icon className="size-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </nav>
      <main data-revio-settings-main="" className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <RevioSettingsPageContent page={page} />
      </main>
    </div>
  )
}
