import { describe, expect, it } from 'vitest'
import { isSafeMirrorPath } from './cloud-mirror'

describe('isSafeMirrorPath', () => {
  it('accepts plain relative paths inside the mirror', () => {
    expect(isSafeMirrorPath('server.js')).toBe(true)
    expect(isSafeMirrorPath('src/app/page.tsx')).toBe(true)
    expect(isSafeMirrorPath('.github/workflows/ci.yml')).toBe(true)
    expect(isSafeMirrorPath('.gitignore')).toBe(true)
    expect(isSafeMirrorPath('docs/.envrc.example')).toBe(true)
  })

  it('refuses anything that could leave the mirror or touch git', () => {
    for (const path of [
      '',
      '/etc/passwd',
      '../outside',
      'a/../../b',
      './a',
      'a//b',
      '.git/config',
      '.git',
      'a\nb',
      'a\0b'
    ]) {
      expect(isSafeMirrorPath(path)).toBe(false)
    }
  })

  it('refuses git data at any depth, in any case, with ignorable characters', () => {
    for (const path of [
      'sub/.git/config',
      'sub/.git/hooks/post-checkout',
      '.GIT/config',
      'vendor/.Git/HEAD',
      '.g‌it/config',
      '﻿.git/hooks/pre-commit',
      '.gitmodules',
      'lib/.gitmodules'
    ]) {
      expect(isSafeMirrorPath(path), JSON.stringify(path)).toBe(false)
    }
  })

  it('refuses files the Mac runs on its own', () => {
    for (const path of [
      '.husky/pre-commit',
      '.githooks/post-merge',
      '.envrc',
      'apps/web/.envrc',
      '.vscode/tasks.json',
      '.vscode/settings.json',
      '.idea/workspace.xml',
      '.zed/tasks.json',
      '.nvim.lua',
      '.exrc',
      '.nvimrc',
      '.lazy.lua',
      'mise.toml',
      '.mise.toml',
      '.VSCode/tasks.json'
    ]) {
      expect(isSafeMirrorPath(path), path).toBe(false)
    }
  })

  it('refuses the repository’s own hooks folder', () => {
    expect(isSafeMirrorPath('tools/hooks/pre-commit', ['tools/hooks'])).toBe(false)
    expect(isSafeMirrorPath('Tools/Hooks/pre-push', ['./tools/hooks/'])).toBe(false)
    expect(isSafeMirrorPath('tools/hooks-docs/readme.md', ['tools/hooks'])).toBe(true)
  })
})
