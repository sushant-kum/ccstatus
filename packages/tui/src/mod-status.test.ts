import { expect, test } from 'vitest'
import { detectModStatus, type RunCmd, type RunResult } from './mod-status.js'

const run = (res: Partial<RunResult>): RunCmd => async () => ({ code: 0, stdout: '', stderr: '', ...res })

test('installed when claude plugin list includes a ccstatus@ entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }, { id: 'ccstatus@ccstatus', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('installed')
})
test('absent when the list has no ccstatus entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('absent')
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
