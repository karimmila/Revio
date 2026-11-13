import React from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { QuickStartTemplate } from '../../../../../../shared/quick-start-types'
import { setQuickStartChoice, useQuickStartChoice } from './quick-start-choice'

/** The Quick start choices on Create: a starter template and a private GitHub repo. */
export function QuickStartOptions({ disabled }: { disabled: boolean }): React.JSX.Element {
  const choice = useQuickStartChoice()
  const templates: { id: QuickStartTemplate; label: string }[] = [
    { id: 'none', label: translate('auto.components.sidebar.quickStart.none', 'No template') },
    { id: 'empty', label: translate('auto.components.sidebar.quickStart.empty', 'Empty') },
    { id: 'nextjs', label: translate('auto.components.sidebar.quickStart.nextjs', 'Next.js') }
  ]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            size="sm"
            variant={choice.template === template.id ? 'secondary' : 'ghost'}
            disabled={disabled}
            onClick={() => setQuickStartChoice({ ...choice, template: template.id })}
          >
            {template.label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={choice.publishToGithub}
          disabled={disabled || !window.api.githubRepos}
          onChange={(event) =>
            setQuickStartChoice({ ...choice, publishToGithub: event.target.checked })
          }
        />
        {translate(
          'auto.components.sidebar.quickStart.publish',
          'Also create a private GitHub repository'
        )}
      </label>
    </div>
  )
}

/** Asks before Create makes a GitHub repository under the person's gh account. */
export function QuickStartPublishConfirm({
  open,
  name,
  onCancel,
  onConfirm
}: {
  open: boolean
  name: string
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.sidebar.quickStart.confirmTitle',
              'Create GitHub repository?'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.sidebar.quickStart.confirmBody',
              '{{productName}} will create the private repository {{value0}} with your gh account and push the first commit.',
              { value0: name }
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {translate('auto.components.sidebar.quickStart.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {translate('auto.components.sidebar.quickStart.confirm', 'Create repository')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
