import { expect, test } from 'vitest'
import { bar, fmtDur, fmtNum, pct } from './format.js'

test('fmtNum', () => {
  expect(fmtNum(42)).toBe('42')
  expect(fmtNum(1500)).toBe('1.5k')
  expect(fmtNum(2000)).toBe('2k')
  expect(fmtNum(1_200_000)).toBe('1.2M')
})
test('fmtDur', () => {
  expect(fmtDur(45_000)).toBe('45s')
  expect(fmtDur(184_000)).toBe('3m 4s')
  expect(fmtDur(3_720_000)).toBe('1h 2m')
  expect(fmtDur(-5)).toBe('0s')
})
test('pct', () => {
  expect(pct(42.6)).toBe('43%')
  expect(pct(0)).toBe('0%')
})
test('bar', () => {
  expect(bar(0)).toBe('░░░░░')
  expect(bar(100)).toBe('█████')
  expect(bar(50, 4)).toBe('██░░')
})
