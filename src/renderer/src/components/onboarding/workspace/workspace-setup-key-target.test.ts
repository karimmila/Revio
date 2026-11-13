// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { describeKeyTarget } from './workspace-setup-keys'

function mount(html: string): void {
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('describeKeyTarget', () => {
  it('does not take the workspace sidebar behind the dialog for an open menu', () => {
    mount(`
      <div id="root"><div role="listbox" aria-label="Worktrees"><div role="option">w</div></div></div>
      <div data-onboarding-overlay><h1 tabindex="-1">Sign in</h1></div>
    `)
    expect(describeKeyTarget(document.querySelector('h1')).popupOpen).toBe(false)
  })

  it('sees a select list in the dialog and a menu portalled over it', () => {
    mount(`
      <div id="root"></div>
      <div data-onboarding-overlay><div role="listbox"></div></div>
    `)
    expect(describeKeyTarget(document.body).popupOpen).toBe(true)
    mount(
      '<div id="root"></div><div data-radix-popper-content-wrapper><div role="menu"></div></div>'
    )
    expect(describeKeyTarget(document.body).popupOpen).toBe(true)
  })

  it('tells a text field and a button from plain text', () => {
    mount('<div id="root"></div><input /><button type="button">Go</button><p>text</p>')
    expect(describeKeyTarget(document.querySelector('input'))).toMatchObject({ editable: true })
    expect(describeKeyTarget(document.querySelector('button'))).toMatchObject({
      editable: false,
      activatable: true
    })
    expect(describeKeyTarget(document.querySelector('p'))).toEqual({
      editable: false,
      activatable: false,
      popupOpen: false
    })
  })
})
