import { afterEach, describe, expect, mock, test } from 'bun:test'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  mock.restore()
})

describe('saveOpenRouterApiKey', () => {
  test('persists the key to config and env while delegating to the shared save flow', async () => {
    const saveApiKey = mock(async () => {})
    const saveGlobalConfig = mock((updater: (current: any) => any) => {
      const next = updater({ env: {}, primaryApiKey: undefined })
      expect(next.primaryApiKey).toBe('or-test-key')
      expect(next.env).toEqual({})
    })

    mock.module('./auth.js', () => ({ saveApiKey }))
    mock.module('./config.js', () => ({ saveGlobalConfig }))

    const { saveOpenRouterApiKey } = await import('./openRouterAuth.js')

    await saveOpenRouterApiKey('or-test-key')

    expect(process.env.OPENROUTER_API_KEY).toBe('or-test-key')
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(saveApiKey).toHaveBeenCalledWith('or-test-key')
    expect(saveGlobalConfig).toHaveBeenCalledTimes(1)
  })
})
