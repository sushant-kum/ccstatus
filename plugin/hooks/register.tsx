import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ccstatus',
      description: 'Toggle the ccstatus band above the prompt',
    })
    return next(e)
  })

  on('command.run', { command: 'ccstatus' }, async () => {
    return { text: 'ccstatus: not wired yet' }
  })
}
