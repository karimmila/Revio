// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { RevioGitStatusStrip } from './RevioGitStatusStrip'

function strip(uncommitted: number, ahead: number, behind: number): string {
  const view = render(
    <RevioGitStatusStrip
      worktreeId="w1"
      uncommitted={uncommitted}
      remoteStatus={{ hasUpstream: true, ahead, behind }}
      behindBase={0}
      baseRef={null}
      runAction={() => {}}
    />
  )
  return view.container.textContent ?? ''
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true)
})

afterEach(cleanup)

describe('RevioGitStatusStrip counts', () => {
  it('uses the singular for one change and one commit', () => {
    expect(strip(1, 0, 0)).toContain('1 uncommitted change')
    expect(strip(1, 0, 0)).not.toContain('1 uncommitted changes')
    expect(strip(0, 1, 0)).toContain('1 commit ahead of remote')
    expect(strip(0, 0, 1)).toContain('1 commit behind remote')
  })

  it('keeps the plural for more than one', () => {
    expect(strip(3, 0, 0)).toContain('3 uncommitted changes')
    expect(strip(0, 2, 0)).toContain('2 commits ahead of remote')
    expect(strip(0, 0, 4)).toContain('4 commits behind remote')
  })
})
