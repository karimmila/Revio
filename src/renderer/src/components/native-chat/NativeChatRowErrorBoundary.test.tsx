// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatRowErrorBoundary } from './NativeChatRowErrorBoundary'

afterEach(cleanup)

function Broken(): React.JSX.Element {
  throw new Error('bad row')
}

it('a row that throws shows the notice; its neighbours still draw', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <>
      <NativeChatRowErrorBoundary>
        <Broken />
      </NativeChatRowErrorBoundary>
      <NativeChatRowErrorBoundary>
        <p>fine row</p>
      </NativeChatRowErrorBoundary>
    </>
  )
  expect(screen.getByText('This chat turn failed to render')).toBeTruthy()
  expect(screen.getByText('Other turns are still available.')).toBeTruthy()
  expect(screen.getByText('fine row')).toBeTruthy()
})
