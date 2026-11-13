import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findClaudeTranscript, placeClaudeTranscriptForResume } from './import-source-transcripts'
import { synthesizeClaudeTranscript } from './import-source-transcript-synthesis'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-transcripts-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('transcript placement', () => {
  it('copies the transcript and its folder into the new workspace bucket, keeping the source', async () => {
    const source = join(root, 'source')
    const bucket = join(source, 'projects', '-old-ws-oslo')
    mkdirSync(join(bucket, 'abc', 'subagents'), { recursive: true })
    const line = '{"type":"user","cwd":"/old/ws/oslo/sub"}\n'
    writeFileSync(join(bucket, 'abc.jsonl'), line)
    writeFileSync(join(bucket, 'abc', 'subagents', 'agent-1.jsonl'), 'x\n')

    const found = await findClaudeTranscript(source, '/old/ws/oslo', 'abc')
    expect(found).toBe(join(bucket, 'abc.jsonl'))
    expect(await findClaudeTranscript(source, '/moved/elsewhere', 'abc')).toBe(found)

    const target = join(root, 'managed')
    const input = {
      sourceFile: found!,
      sourceCwd: '/old/ws/oslo',
      sessionId: 'abc',
      targetHome: target,
      workspacePath: '/new/wt.x'
    }
    expect(await placeClaudeTranscriptForResume(input)).toBe('copied')
    expect(readFileSync(join(target, 'projects', '-new-wt-x', 'abc.jsonl'), 'utf8')).toBe(
      '{"type":"user","cwd":"/new/wt.x/sub"}\n'
    )
    expect(
      existsSync(join(target, 'projects', '-new-wt-x', 'abc', 'subagents', 'agent-1.jsonl'))
    ).toBe(true)
    expect(await placeClaudeTranscriptForResume(input)).toBe('already-present')
    expect(readFileSync(found!, 'utf8')).toBe(line)
  })
})

describe('synthesizeClaudeTranscript', () => {
  it('chains prompts and top-level events and drops subagent and status events', () => {
    let next = 0
    const contents = synthesizeClaudeTranscript({
      rows: [
        { role: 'user', content: 'fix it', createdAt: '2026-11-01T00:00:00Z' },
        { role: 'assistant', content: '{"type":"system","subtype":"init"}', createdAt: null },
        {
          role: 'assistant',
          content:
            '{"type":"assistant","uuid":"u2","message":{"role":"assistant","content":[]},"timestamp":"t2"}',
          createdAt: null
        },
        {
          role: 'assistant',
          content: '{"type":"assistant","uuid":"sub","parent_tool_use_id":"tool","message":{}}',
          createdAt: null
        },
        {
          role: 'assistant',
          content: '{"type":"user","uuid":"u3","message":{"role":"user","content":[]}}',
          createdAt: 't3'
        }
      ],
      sessionId: 'sess',
      cwd: '/wt',
      gitBranch: 'me/b',
      randomId: () => `gen-${++next}`
    })
    const lines = contents
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(lines.map((line) => [line.type, line.uuid, line.parentUuid])).toEqual([
      ['user', 'gen-1', null],
      ['assistant', 'u2', 'gen-1'],
      ['user', 'u3', 'u2']
    ])
    expect(lines[0]).toMatchObject({
      sessionId: 'sess',
      cwd: '/wt',
      gitBranch: 'me/b',
      message: { content: 'fix it' }
    })
    expect(lines[2].timestamp).toBe('t3')
  })
})
