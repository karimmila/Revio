// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatApprovalCard } from './NativeChatApprovalCard'
import { planHandOffDraft } from './native-chat-plan-hand-off'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const plan = {
  title: 'Review proposed plan',
  subject: { kind: 'plan' as const, text: 'Edit a.ts', filePath: '/p/plan.md' },
  options: [
    { label: 'Approve', send: 'approve' },
    { label: 'No', send: 'deny' }
  ]
}

it('a plan offers Copy and Hand off beside, not among, its approval options', async () => {
  const write = vi.fn(async () => {})
  vi.stubGlobal('api', { ui: { writeClipboardText: write } })
  const onHandOffPlan = vi.fn()
  const view = render(
    <TooltipProvider>
      <NativeChatApprovalCard approval={plan} onChoose={vi.fn()} onHandOffPlan={onHandOffPlan} />
    </TooltipProvider>
  )
  const options = view.container.querySelector('[data-native-chat-approval-actions]')!
  expect(options.querySelectorAll('button')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Approve' }).title).toBe('Execute plan in current chat')
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  expect(write).toHaveBeenCalledWith('Edit a.ts')
  fireEvent.click(screen.getByRole('button', { name: 'Hand off' }))
  expect(onHandOffPlan).toHaveBeenCalledWith('Edit a.ts', '/p/plan.md')
})

it('the hand-off draft carries the plan and its file', () => {
  expect(planHandOffDraft(' Do it \n', '/p/plan.md')).toBe(
    'Implement this plan:\n\nDo it\n\n(Plan file: /p/plan.md)'
  )
})
