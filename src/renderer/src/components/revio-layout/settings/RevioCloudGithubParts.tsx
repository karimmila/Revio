import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { githubAvatarUrl } from './revio-cloud-github-view'

/** The account's avatar, falling back to the GitHub mark when the image cannot load. */
function GithubAvatar({ host, login }: { host: string; login: string }): React.JSX.Element {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return <GitHubIcon className="size-4 shrink-0" />
  }
  return (
    <img
      src={githubAvatarUrl(host, login)}
      alt=""
      className="size-4 shrink-0 rounded-full"
      onError={() => setFailed(true)}
    />
  )
}

/** The connected line: a green dot, a lead-in, the avatar and the bold login. */
export function GithubAccountLine({
  host,
  login,
  lead,
  dot = true
}: {
  host: string
  login: string
  lead: string
  /** Off where a done check already says the same, as in the onboarding steps. */
  dot?: boolean
}): React.JSX.Element {
  return (
    <span data-revio-github-account="" className="flex min-w-0 items-center gap-1.5">
      {dot ? (
        <span aria-hidden className="mr-0.5 size-2 shrink-0 rounded-full bg-status-success" />
      ) : null}
      <span className="shrink-0">{lead}</span>
      <GithubAvatar host={host} login={login} />
      <span className="truncate font-medium text-foreground">{login}</span>
    </span>
  )
}

export function GithubChecking(): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {translate('auto.components.revioLayout.settings.checking', 'Checking…')}
    </span>
  )
}

export function GithubErrorLine({ message }: { message: string }): React.JSX.Element {
  return (
    <span role="alert" className="flex items-start gap-1.5 text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </span>
  )
}

/** The warning a lapsed sign-in shows in place of the account row, with "Sign in again" beside it. */
export function GithubExpiredLine(): React.JSX.Element {
  return (
    <span data-github-expired="" className="flex items-start gap-1.5">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden />
      <span>
        <span className="font-medium text-foreground">
          {translate(
            'auto.components.revioLayout.settings.githubExpiredTitle',
            'GitHub access expired.'
          )}
        </span>{' '}
        {translate(
          'auto.components.revioLayout.settings.githubExpiredBody',
          'Sign in again to keep cloud workspaces pushing.'
        )}
      </span>
    </span>
  )
}

export function GithubSignInButton({
  expired,
  onClick
}: {
  expired: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" data-revio-settings-button="" onClick={onClick}>
      <GitHubIcon className="size-3.5" />
      {expired
        ? translate('auto.components.revioLayout.settings.githubSignInAgain', 'Sign in again')
        : translate('auto.components.revioLayout.settings.githubSignIn', 'Sign in with GitHub')}
    </button>
  )
}

/** While GitHub waits for the code: the disabled sign-in button turns into the wait, plus Cancel. */
export function GithubWaitingControl({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  return (
    <>
      <button type="button" data-revio-settings-button="" disabled>
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {translate(
          'auto.components.revioLayout.settings.githubWaitingAuth',
          'Waiting for authorization…'
        )}
      </button>
      <button type="button" data-revio-settings-text-button="" onClick={onCancel}>
        {translate('auto.components.revioLayout.cancel', 'Cancel')}
      </button>
    </>
  )
}

/** The device flow as numbered one-time steps; clicking the code copies it, like the copy icon. */
export function GithubDeviceCode({
  code,
  onOpen
}: {
  code: string
  onOpen: () => void
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  const copy = (): void => {
    void window.api.ui
      .writeClipboardText(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }
  const copyLabel = translate('auto.components.revioLayout.settings.githubCopyCode', 'Copy code')
  // The code appears under the button that asked for it, often below the fold of a short window.
  const steps = React.useRef<HTMLOListElement>(null)
  React.useEffect(() => {
    steps.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return (
    <ol ref={steps} data-revio-github-steps="" className="flex flex-col gap-3 text-[13px]">
      <li className="flex gap-2">
        <span className="text-muted-foreground">1.</span>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <p>
            {translate(
              'auto.components.revioLayout.settings.githubOpenStep',
              'Open the GitHub device page.'
            )}
          </p>
          <button type="button" data-revio-settings-button="" data-size="sm" onClick={onOpen}>
            {translate('auto.components.revioLayout.settings.githubOpen', 'Open GitHub')}
            <ExternalLink className="size-3" aria-hidden />
          </button>
        </div>
      </li>
      <li className="flex gap-2">
        <span className="text-muted-foreground">2.</span>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <p>
            {translate(
              'auto.components.revioLayout.settings.githubEnterCodeStep',
              'Enter this code when GitHub asks for it:'
            )}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-revio-device-code=""
              onClick={copy}
              aria-label={`${copyLabel}: ${code}`}
            >
              {code}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={copy}
              aria-label={copyLabel}
            >
              {copied ? <Check className="text-status-success" /> : <Copy />}
            </Button>
          </div>
        </div>
      </li>
    </ol>
  )
}

/**
 * Signed-in actions behind one "…" button, like the GitHub app options. Sign out asks first,
 * as the Disconnect does, because it only forgets the token here: the app stays authorized
 * on GitHub until the user revokes it there.
 */
export function GithubAccountMenu({
  onRevoke,
  onSignOut
}: {
  onRevoke: () => void
  onSignOut: () => Promise<void>
}): React.JSX.Element {
  const [confirming, setConfirming] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const signOut = (): void => {
    setPending(true)
    void onSignOut().finally(() => {
      setPending(false)
      setConfirming(false)
    })
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={translate(
              'auto.components.revioLayout.settings.githubOptions',
              'GitHub options'
            )}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRevoke}>
            <ExternalLink />
            {translate('auto.components.revioLayout.settings.githubRevoke', 'Revoke on GitHub')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            {translate('auto.components.revioLayout.settings.githubSignOut', 'Sign out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        {/* Above the first-run overlay (z-100), where this menu also appears. */}
        <DialogContent
          className="z-[120] max-w-sm sm:max-w-sm"
          overlayClassName="z-[110]"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              {translate(
                'auto.components.revioLayout.settings.githubSignOutTitle',
                'Sign out of GitHub?'
              )}
            </DialogTitle>
            <DialogDescription>
              {translate(
                'auto.components.revioLayout.settings.githubSignOutBody',
                'Cloud workspaces lose GitHub access, and this Mac forgets the token. The {{value0}} GitHub App stays authorized on your GitHub account until you revoke it.',
                { value0: FORK_PRODUCT_NAME }
              )}{' '}
              <button
                type="button"
                className="inline text-foreground underline underline-offset-2 hover:no-underline"
                onClick={onRevoke}
              >
                {translate(
                  'auto.components.revioLayout.settings.githubSignOutRevokeLink',
                  'Revoke in GitHub settings'
                )}
              </button>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              {translate('auto.components.revioLayout.cancel', 'Cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={signOut}>
              {pending
                ? translate('auto.components.revioLayout.settings.githubSigningOut', 'Signing out…')
                : translate('auto.components.revioLayout.settings.githubSignOut', 'Sign out')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
