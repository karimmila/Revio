import { useEffect } from 'react'
import { useAppStore } from '@/store'

/**
 * "Sidebar transparency": Electron vibrancy covers the whole window, so the sidebar
 * alone shows it by leaving the body transparent only under the sidebar (main.css reads the width
 * published here) and keeping everything to its right on the opaque base.
 */
export function useRevioSidebarVibrancy(): void {
  const on = useAppStore(
    (s) => s.settings?.revioLayout === true && s.settings?.revioSidebarTransparency === true
  )
  useEffect(() => {
    const root = document.documentElement
    const sidebar = document.querySelector<HTMLElement>('[data-revio-sidebar-surface]')
    if (!on || !sidebar) {
      delete root.dataset.revioSidebarVibrancy
      root.style.removeProperty('--revio-sidebar-width')
      return
    }
    root.dataset.revioSidebarVibrancy = 'true'
    const publish = (): void => {
      root.style.setProperty('--revio-sidebar-width', `${sidebar.getBoundingClientRect().right}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(sidebar)
    return () => {
      observer.disconnect()
      delete root.dataset.revioSidebarVibrancy
      root.style.removeProperty('--revio-sidebar-width')
    }
  }, [on])
}
