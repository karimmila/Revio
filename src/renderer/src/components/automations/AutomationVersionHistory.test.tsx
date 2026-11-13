// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutomationVersionHistory } from './AutomationVersionHistory'
import { recordAutomationVersion } from './automation-version-history'
import { makeAutomation } from './automations-page-fixtures'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function clickButton(label: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (entry) => entry.textContent?.trim() === label
  )
  if (!button) {
    throw new Error(`No button "${label}"`)
  }
  act(() => button.click())
}

describe('AutomationVersionHistory', () => {
  it('says there are no versions yet', () => {
    act(() => {
      root.render(
        <AutomationVersionHistory automationId="a-1" disabled={false} onRevert={vi.fn()} />
      )
    })
    clickButton('Version history')
    expect(document.body.textContent).toContain('No versions')
  })

  it('marks the newest version Current and reverts an older one after confirming', () => {
    recordAutomationVersion(makeAutomation({ name: 'First' }), 1)
    recordAutomationVersion(makeAutomation({ name: 'Second' }), 2)
    const onRevert = vi.fn()
    act(() => {
      root.render(
        <AutomationVersionHistory automationId="a-1" disabled={false} onRevert={onRevert} />
      )
    })
    clickButton('Version history')
    expect(document.body.textContent).toContain('Current')
    expect(document.body.textContent).toContain('First')
    clickButton('Revert')
    expect(document.body.textContent).toContain('Revert to version 1?')
    expect(onRevert).not.toHaveBeenCalled()
    clickButton('Revert')
    expect(onRevert).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }))
  })
})
