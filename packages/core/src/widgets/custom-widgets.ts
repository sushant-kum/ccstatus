import { register } from './registry.js'

register({
  type: 'custom-text', label: 'Custom text',
  format: ({ item }) => {
    const text = String(item.metadata?.['text'] ?? '')
    return text.length ? text : null
  },
})

register({
  type: 'custom-command', label: 'Custom command',
  format: ({ item, commandOutputs }) => {
    const out = (commandOutputs[item.id] ?? '').trim()
    return out.length ? out : null
  },
})

register({ type: 'flex-separator', label: 'Flex separator', format: () => '' })
