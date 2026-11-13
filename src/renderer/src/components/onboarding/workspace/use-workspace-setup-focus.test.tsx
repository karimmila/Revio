// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { setupFocusEscaped, useWorkspaceSetupFocus } from './use-workspace-setup-focus'

function Harness({ step, suspended }: { step: string; suspended: boolean }): React.JSX.Element {
  const dialogRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useWorkspaceSetupFocus({ dialogRef, headingRef, stepKey: step, suspended })
  return (
    <>
      <button type="button">Help</button>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-label="Setup">
        <h1 ref={headingRef} tabIndex={-1}>
          {step}
        </h1>
        <button type="button">Check again</button>
      </section>
      <div role="menu">
        <button type="button">Menu item</button>
      </div>
    </>
  )
}

afterEach(cleanup)

describe('useWorkspaceSetupFocus', () => {
  it('focuses the step heading on open and again when the app dialog over it closes', () => {
    const view = render(<Harness step="agent" suspended={false} />)
    expect(document.activeElement).toBe(view.getByRole('heading'))
    view.rerender(<Harness step="agent" suspended />)
    view.getByText('Help').focus()
    view.rerender(<Harness step="agent" suspended={false} />)
    expect(document.activeElement).toBe(view.getByRole('heading'))
  })

  it('takes focus back from the page behind, but not from a menu a step opened', () => {
    const view = render(<Harness step="agent" suspended={false} />)
    view.getByText('Help').focus()
    expect(document.activeElement).toBe(view.getByRole('dialog'))
    view.getByText('Check again').focus()
    expect(document.activeElement).toBe(view.getByText('Check again'))
    view.getByText('Menu item').focus()
    expect(document.activeElement).toBe(view.getByText('Menu item'))
  })

  it('leaves focus alone while the app dialog owns the screen', () => {
    const view = render(<Harness step="agent" suspended />)
    view.getByText('Help').focus()
    expect(document.activeElement).toBe(view.getByText('Help'))
  })
})

describe('setupFocusEscaped', () => {
  it('counts <body> and no element as escaped', () => {
    const dialog = document.createElement('section')
    document.body.append(dialog)
    expect(setupFocusEscaped(document.body, dialog)).toBe(true)
    expect(setupFocusEscaped(null, dialog)).toBe(true)
    expect(setupFocusEscaped(dialog, dialog)).toBe(false)
    dialog.remove()
  })
})
