#!/usr/bin/env node
// Rasterizes the Revio SVG sources into every committed icon asset using only macOS built-ins
// (qlmanage, iconutil) plus pngjs, so regenerating needs no Xcode, ImageMagick or downloads.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PNG } from 'pngjs'
import { buildWindowsIcoFromPng } from '../../config/scripts/desktop-distribution/windows/trim-windows-icon-source.mjs'

const SOURCE_DIR = import.meta.dirname
const RESOURCES_DIR = join(SOURCE_DIR, '..')
const BUILD_DIR = join(RESOURCES_DIR, 'build')
// Small macOS list-view slots read the .icns directly; drop the Dock safe-area inset there so
// the glyph stays legible at 16-64px.
const FULL_BLEED_VIEW_BOX = '100 100 824 824'

const tmpRoot = mkdtempSync(join(tmpdir(), 'revio-icons-'))

function withRootAttributes(svg, { width, height, viewBox, background }) {
  let out = svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${width}"`)
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${height}"`)
  if (viewBox) {
    out = out.replace(/(<svg\b[^>]*?)\sviewBox="[^"]*"/, `$1 viewBox="${viewBox}"`)
  }
  if (background) {
    const box = /<svg\b[^>]*?\sviewBox="([^"]*)"/
      .exec(out)[1]
      .trim()
      .split(/[\s,]+/)
    out = out.replace(
      /(<svg\b[^>]*>)/,
      `$1<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${background}"/>`
    )
  }
  return out
}

function quickLookRender(svg, size, name) {
  const dir = join(tmpRoot, `${name}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir)
  const svgPath = join(dir, 'in.svg')
  writeFileSync(svgPath, svg)
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', dir, svgPath], { stdio: 'ignore' })
  return PNG.sync.read(readFileSync(`${svgPath}.png`))
}

// Quick Look always composites onto opaque white, so render over white and over black and
// recover alpha from the difference (standard two-background matting).
// Quick Look shrinks small thumbnails inside a white canvas, so always render near 1024px and
// box-filter down by an integer factor.
const RENDER_TARGET_PX = 1024

function renderSvg(sourceName, width, height, viewBoxOverride) {
  const svg = readFileSync(join(SOURCE_DIR, sourceName), 'utf8')
  const factor = Math.max(1, Math.floor(RENDER_TARGET_PX / Math.max(width, height)))
  const size = Math.max(width, height) * factor
  // Quick Look only emits square thumbnails, so render non-square art on a square canvas and crop.
  const [x, y, w, h] = (viewBoxOverride ?? /<svg\b[^>]*?\sviewBox="([^"]*)"/.exec(svg)[1])
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const side = Math.max(w, h)
  const viewBox = `${x - (side - w) / 2} ${y - (side - h) / 2} ${side} ${side}`
  const render = (background) =>
    quickLookRender(
      withRootAttributes(svg, { width: size, height: size, viewBox, background }),
      size,
      background ? 'b' : 'w'
    )
  const onWhite = render(undefined)
  const onBlack = render('#000000')
  if (onWhite.width !== size || onWhite.height !== size) {
    throw new Error(
      `${sourceName}: Quick Look rendered ${onWhite.width}x${onWhite.height}, expected ${size}x${size}`
    )
  }
  const left = Math.round((size - width * factor) / 2)
  const top = Math.round((size - height * factor) / 2)
  const out = new PNG({ width, height })
  const samples = factor * factor
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // Average in premultiplied space so transparent edges do not darken or fringe.
      let alphaSum = 0
      const colorSum = [0, 0, 0]
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const src = ((top + row * factor + dy) * size + left + col * factor + dx) * 4
          let diff = 0
          for (let c = 0; c < 3; c++) {
            diff += onWhite.data[src + c] - onBlack.data[src + c]
          }
          alphaSum += Math.min(255, Math.max(0, 255 - diff / 3))
          for (let c = 0; c < 3; c++) {
            colorSum[c] += onBlack.data[src + c]
          }
        }
      }
      const dst = (row * width + col) * 4
      const alpha = alphaSum / samples
      for (let c = 0; c < 3; c++) {
        out.data[dst + c] =
          alpha < 0.5 ? 0 : Math.min(255, Math.round((colorSum[c] / samples) * (255 / alpha)))
      }
      out.data[dst + 3] = Math.round(alpha)
    }
  }
  return PNG.sync.write(out)
}

function writeRender(target, sourceName, width, height = width, viewBox) {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, renderSvg(sourceName, width, height, viewBox))
  console.log(`  -> ${target.slice(RESOURCES_DIR.length - 'resources'.length)}`)
}

try {
  const iconset = join(tmpRoot, 'icon.iconset')
  mkdirSync(iconset)
  for (const [base, scale] of [
    [16, 1],
    [16, 2],
    [32, 1],
    [32, 2],
    [128, 1],
    [128, 2],
    [256, 1],
    [256, 2],
    [512, 1],
    [512, 2]
  ]) {
    const px = base * scale
    const file = `icon_${base}x${base}${scale === 2 ? '@2x' : ''}.png`
    const viewBox = px <= 64 ? FULL_BLEED_VIEW_BOX : undefined
    writeFileSync(join(iconset, file), renderSvg('revio.svg', px, px, viewBox))
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(BUILD_DIR, 'icon.icns')])
  console.log('  -> resources/build/icon.icns')

  writeRender(join(BUILD_DIR, 'icon.png'), 'revio.svg', 1024)
  writeFileSync(
    join(BUILD_DIR, 'icon.ico'),
    buildWindowsIcoFromPng(readFileSync(join(BUILD_DIR, 'icon.png')))
  )
  console.log('  -> resources/build/icon.ico')

  writeRender(join(RESOURCES_DIR, 'icon.png'), 'revio.svg', 256)
  writeRender(join(RESOURCES_DIR, 'icon-dev.png'), 'revio-dev.svg', 256)
  writeRender(
    join(RESOURCES_DIR, 'app-icons', 'revio-watercolor.png'),
    'revio-watercolor.svg',
    1024
  )
  writeRender(join(RESOURCES_DIR, 'app-icons', 'revio-blue.png'), 'revio-blue.svg', 1024)
  writeRender(
    join(RESOURCES_DIR, 'tray', 'revio-menu-barTemplate.png'),
    'revio-menu-bar-template.svg',
    22,
    14
  )
  writeRender(
    join(RESOURCES_DIR, 'tray', 'revio-menu-barTemplate@2x.png'),
    'revio-menu-bar-template.svg',
    44,
    28
  )
} finally {
  rmSync(tmpRoot, { recursive: true, force: true })
}
