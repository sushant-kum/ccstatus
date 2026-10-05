import { execFile } from 'node:child_process'

export const MARKETPLACE_SLUG = 'sushant-kum/ccstatus'
export const MARKETPLACE_NAME = 'ccstatus'
export const PLUGIN_ID = 'ccstatus@ccstatus'

export type ModStatus = 'installed' | 'absent' | 'unknown'
export type RunResult = { code: number; stdout: string; stderr: string }
export type RunCmd = (argv: string[]) => Promise<RunResult>

// Default runner: execFile the given binary. Resolves (never rejects) with the
// child's exit code, or -1 when the binary is missing / can't spawn (ENOENT),
// so a missing `claude` on PATH is a normal non-fatal outcome for callers.
export const runCmd: RunCmd = (argv) => new Promise((resolve) => {
  execFile(argv[0]!, argv.slice(1), { timeout: 10_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    const errCode = (err as { code?: unknown } | null)?.code
    const code = typeof errCode === 'number' ? errCode : err ? -1 : 0
    resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
  })
})

// 'installed' | 'absent' | 'unknown'. Any failure to get a clean answer
// (claude missing, non-zero, non-JSON, wrong shape, thrown) is 'unknown'.
export async function detectModStatus(run: RunCmd = runCmd): Promise<ModStatus> {
  let res: RunResult
  try { res = await run(['claude', 'plugin', 'list', '--json']) }
  catch { return 'unknown' }
  if (res.code !== 0) return 'unknown'
  let parsed: unknown
  try { parsed = JSON.parse(res.stdout) } catch { return 'unknown' }
  if (!Array.isArray(parsed)) return 'unknown'
  const found = parsed.some((p) =>
    !!p && typeof p === 'object'
    && typeof (p as { id?: unknown }).id === 'string'
    && (p as { id: string }).id.startsWith('ccstatus@'))
  return found ? 'installed' : 'absent'
}

export type InstallResult = { ok: boolean; message: string }

const firstLine = (s: string): string => s.split('\n').map((l) => l.trim()).find(Boolean) ?? ''

// Opt-in only (called from an explicit keypress). Adds the marketplace, then
// installs non-interactively (-y). On success the mod still loads only on the
// next Claude Code start / /reload-plugins — the message says so.
export async function installMod(run: RunCmd = runCmd): Promise<InstallResult> {
  const add = await run(['claude', 'plugin', 'marketplace', 'add', MARKETPLACE_SLUG])
  if (add.code !== 0) return { ok: false, message: `marketplace add failed: ${firstLine(add.stderr || add.stdout) || `exit ${add.code}`}` }
  const inst = await run(['claude', 'plugin', 'install', PLUGIN_ID, '-y'])
  if (inst.code !== 0) return { ok: false, message: `install failed: ${firstLine(inst.stderr || inst.stdout) || `exit ${inst.code}`}` }
  return { ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' }
}
