import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: class {},
  nativeTheme: {},
  powerMonitor: { on: vi.fn() },
  screen: {}
}))

const { devWindowPlacement } = await import('./createMainWindow')

describe('devWindowPlacement', () => {
  it('reads x,y,width,height for dev and test instances', () => {
    expect(devWindowPlacement('989, 1473, 1440, 900', false)).toEqual({
      x: 989,
      y: 1473,
      width: 1440,
      height: 900
    })
  })

  it('is ignored in packaged builds and for malformed values', () => {
    expect(devWindowPlacement('1,2,3,4', true)).toBeNull()
    expect(devWindowPlacement('1,2,3', false)).toBeNull()
    expect(devWindowPlacement('a,b,c,d', false)).toBeNull()
    expect(devWindowPlacement(undefined, false)).toBeNull()
  })
})
