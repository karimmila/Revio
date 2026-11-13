// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Archive, Folder } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REVIO_HOME_HEADER_LEVELS, type RevioHomeHeaderLevel } from './revio-home-header-fit'
import { RevioHomeToolbar, revioHomeToolbarMenu } from './RevioHomeToolbar'

// What the controls need at each level, as a real header measures it (search field included).
const NEEDED: Record<RevioHomeHeaderLevel, number> = {
  labels: 720,
  'main-labels': 540,
  icons: 380,
  menu: 160
}
const CLEAR_FILTERS = 90

let available = 0
let observers: (() => void)[] = []

function headerLevel(element: Element): RevioHomeHeaderLevel {
  const level = REVIO_HOME_HEADER_LEVELS.find(
    (candidate) => candidate === element.getAttribute('data-revio-home-header')
  )
  if (!level) {
    throw new Error('The header names no level')
  }
  return level
}

function needed(element: Element): number {
  const level = headerLevel(element)
  const inlineClear = level !== 'menu' && screen.queryByText('Clear filters') !== null
  return NEEDED[level] + (inlineClear ? CLEAR_FILTERS : 0)
}

beforeEach(() => {
  observers = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly notify: () => void
      constructor(callback: () => void) {
        this.notify = callback
      }
      observe(): void {
        observers.push(this.notify)
      }
      disconnect(): void {
        observers = observers.filter((notify) => notify !== this.notify)
      }
    }
  )
  // The header is the only element these tests measure.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => available)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return Math.max(available, needed(this))
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function resizeTo(width: number): void {
  available = width
  act(() => {
    for (const notify of observers) {
      notify()
    }
  })
}

function toolbar(overrides: { filtered?: boolean; onProject?: (value: string) => void } = {}) {
  const onCreate = vi.fn()
  const onClearFilters = vi.fn()
  const menus = [
    revioHomeToolbarMenu({
      id: 'project',
      icon: Folder,
      value: 'all',
      onChange: overrides.onProject ?? vi.fn(),
      options: [
        { value: 'all', label: 'All projects' },
        { value: 'web', label: 'web' }
      ]
    }),
    revioHomeToolbarMenu<'active' | 'archived'>({
      id: 'filter',
      icon: Archive,
      main: true,
      value: 'active',
      onChange: vi.fn(),
      options: [
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Only archived' }
      ]
    })
  ]
  const view = render(
    <RevioHomeToolbar
      query=""
      onQueryChange={vi.fn()}
      filtered={overrides.filtered === true}
      onClearFilters={onClearFilters}
      menus={menus}
      onCreate={onCreate}
    />
  )
  const header = view.container.querySelector('header')
  if (!header) {
    throw new Error('No header')
  }
  return { header, onCreate, onClearFilters }
}

describe('Home header', () => {
  it('shows every label when its own width has room for them', () => {
    available = 900
    const { header } = toolbar()
    expect(headerLevel(header)).toBe('labels')
    expect(screen.getByText('All projects')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' }).textContent).toBe('Create')
  })

  it('never leaves a control cut off, at any width a window and a sidebar can give it', () => {
    available = 900
    const { header } = toolbar()
    // 600 is the smallest window; an open sidebar takes up to 400 of it.
    for (let width = 900; width >= 200; width -= 7) {
      resizeTo(width)
      expect(needed(header), `at ${width}`).toBeLessThanOrEqual(width)
      expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
    }
    for (let width = 200; width <= 900; width += 11) {
      resizeTo(width)
      expect(needed(header), `at ${width}`).toBeLessThanOrEqual(width)
    }
  })

  it('takes the richest level that fits: the measured header, not the window, decides', () => {
    available = 900
    const { header } = toolbar()
    const window600WithSidebar = 320
    resizeTo(window600WithSidebar)
    expect(headerLevel(header)).toBe('menu')
    // The same window with the sidebar closed has room for the icons.
    resizeTo(600)
    expect(headerLevel(header)).toBe('main-labels')
    resizeTo(480)
    expect(headerLevel(header)).toBe('icons')
    expect(screen.queryByText('Active')).toBeNull()
    expect(screen.getByRole('button', { name: 'Active' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' }).textContent).toBe('')
    resizeTo(900)
    expect(headerLevel(header)).toBe('labels')
  })

  it('folds the menus into one menu, with Create still beside it, when icons do not fit', () => {
    available = 320
    const { onCreate } = toolbar()
    expect(screen.queryByRole('button', { name: 'Active' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter, sort and display' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('gives up labels sooner while "Clear filters" takes its room', () => {
    available = 580
    const plain = toolbar()
    expect(headerLevel(plain.header)).toBe('main-labels')
    cleanup()
    const filtered = toolbar({ filtered: true })
    expect(headerLevel(filtered.header)).toBe('icons')
    expect(screen.getByText('Clear filters')).toBeTruthy()
  })
})
