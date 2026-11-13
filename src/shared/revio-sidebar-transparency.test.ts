import { expect, it } from 'vitest'
import { sidebarTransparencyUpdate } from './revio-sidebar-transparency'

it('switches to Blur when there is no material and puts the old one back when turned off', () => {
  const on = sidebarTransparencyUpdate(true, { windowMaterial: 'off' })
  expect(on).toEqual({
    revioSidebarTransparency: true,
    windowMaterial: 'blur',
    revioSidebarTransparencyPriorMaterial: 'off'
  })
  expect(sidebarTransparencyUpdate(false, { ...on })).toEqual({
    revioSidebarTransparency: false,
    windowMaterial: 'off',
    revioSidebarTransparencyPriorMaterial: undefined
  })
})

it('keeps a material the person chose, before and after', () => {
  expect(sidebarTransparencyUpdate(true, { windowMaterial: 'translucent' })).toEqual({
    revioSidebarTransparency: true
  })
  // Changed to Translucent after turning it on: turning it off keeps that choice.
  expect(
    sidebarTransparencyUpdate(false, {
      windowMaterial: 'translucent',
      revioSidebarTransparencyPriorMaterial: 'off'
    })
  ).toEqual({
    revioSidebarTransparency: false,
    revioSidebarTransparencyPriorMaterial: undefined
  })
})
