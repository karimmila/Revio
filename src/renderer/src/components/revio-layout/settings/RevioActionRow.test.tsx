// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { RepoAction } from '../../../../../shared/actions/repo-actions'
import { RevioActionRow } from './RevioActionRow'

afterEach(cleanup)

function renderRow(action: RepoAction, onChange = vi.fn()): ReturnType<typeof render> {
  return render(
    <RevioActionRow
      action={action}
      first
      last
      onChange={onChange}
      onMove={vi.fn()}
      onRemove={vi.fn()}
      hidden={false}
      onToggleHidden={vi.fn()}
    />
  )
}

const action: RepoAction = {
  id: 'personal:a',
  name: 'Dev',
  script: 'pnpm dev',
  targets: ['local'],
  shared: false
}

it('offers no control to share an action into .orca/actions.toml', () => {
  const view = renderRow(action)
  expect(view.queryByRole('switch')).toBeNull()
  expect(view.container.textContent).not.toContain('actions.toml')
  expect(view.container.textContent).not.toContain('Personal')
})

it('keeps an existing shared action shared when it is edited', () => {
  const onChange = vi.fn()
  const view = renderRow({ ...action, id: 'shared:a', shared: true }, onChange)
  fireEvent.change(view.getByLabelText('Action name'), { target: { value: 'Serve' } })
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Serve', shared: true }))
})
