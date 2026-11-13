import type { Plugin } from 'vite'

/**
 * The renderer pages ship upstream titles ("Orca", "Orca Agent Dashboard"), and the window takes
 * its title from the page. This swaps the product name in each <title> for the fork's; the dev
 * server adds " Dev" so a dev window is told apart from the installed app.
 */
export function createForkHtmlTitlePlugin(productName: string): Plugin {
  let suffix = ''
  return {
    name: 'fork-html-title',
    configResolved(config) {
      suffix = config.command === 'serve' ? ' Dev' : ''
    },
    transformIndexHtml(html) {
      return renameHtmlTitle(html, `${productName}${suffix}`)
    }
  }
}

export function renameHtmlTitle(html: string, name: string): string {
  return html.replace(
    /<title>([^<]*)<\/title>/,
    (_tag, title: string) => `<title>${title.replace(/\bOrca\b/, name)}</title>`
  )
}
