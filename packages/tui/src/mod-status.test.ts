import { expect, test } from 'vitest'
import { detectModStatus, installMod, type RunCmd, type RunResult } from './mod-status.js'

const run = (res: Partial<RunResult>): RunCmd => async () => ({ code: 0, stdout: '', stderr: '', ...res })

test('installed when claude plugin list includes a ccstatus@ entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }, { id: 'ccstatus@ccstatus', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('installed')
})
test('absent when the list has no ccstatus entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('absent')
})
test('disabled when the ccstatus entry is present but enabled:false', async () => {
  const stdout = JSON.stringify([{ id: 'ccstatus@ccstatus', enabled: false }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('disabled')
})
test('installed when the ccstatus entry has no enabled field (treat as enabled)', async () => {
  const stdout = JSON.stringify([{ id: 'ccstatus@ccstatus' }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('installed')
})
test('unknown when claude is not on PATH (non-zero exit)', async () => {
  expect(await detectModStatus(run({ code: -1, stderr: 'ENOENT' }))).toBe('unknown')
})
test('unknown when output is not JSON', async () => {
  expect(await detectModStatus(run({ code: 0, stdout: 'not json' }))).toBe('unknown')
})
test('unknown when output is JSON but not an array', async () => {
  expect(await detectModStatus(run({ code: 0, stdout: '{"id":"ccstatus@ccstatus"}' }))).toBe('unknown')
})
test('detection never rejects even if the runner throws', async () => {
  const throwing: RunCmd = async () => { throw new Error('spawn boom') }
  await expect(detectModStatus(throwing)).resolves.toBe('unknown')
})

const seq = (results: Partial<RunResult>[]): RunCmd => {
  let i = 0
  return async () => ({ code: 0, stdout: '', stderr: '', ...(results[i++] ?? {}) })
}

test('install runs marketplace add then install and reports the reload caveat', async () => {
  const r = await installMod(seq([{ code: 0 }, { code: 0 }]))
  expect(r.ok).toBe(true)
  expect(r.message).toMatch(/restart Claude Code|reload/i)
})
test('install reports marketplace-add failure without claiming success', async () => {
  const r = await installMod(seq([{ code: 1, stderr: 'network down' }, { code: 0 }]))
  expect(r.ok).toBe(false)
  expect(r.message).toMatch(/marketplace add failed/i)
})
test('install reports the install-step failure', async () => {
  const r = await installMod(seq([{ code: 0 }, { code: 1, stderr: 'no such plugin' }]))
  expect(r.ok).toBe(false)
  expect(r.message).toMatch(/install failed/i)
})
