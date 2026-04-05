import { afterEach, describe, expect, mock, test } from 'bun:test'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  mock.restore()
})

describe('getAPIProvider', () => {
  test.each([
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
  ])(
    'returns firstParty even when legacy flag %s is present',
    async (envVar) => {
      mock.restore()
      process.env[envVar] = '1'

      const { getAPIProvider } = await import(`./providers.js?${envVar}`)

      expect(getAPIProvider()).toBe('firstParty')
    },
  )
})

describe('isFirstPartyAnthropicBaseUrl', () => {
  test('returns true for Anthropic first-party hosts', async () => {
    const { isFirstPartyAnthropicBaseUrl } = await import('./providers.js?hosts')

    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)

    process.env.USER_TYPE = 'ant'
    process.env.ANTHROPIC_BASE_URL = 'https://api-staging.anthropic.com/v1'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)
  })

  test('does not treat the OpenRouter Anthropic-compatible host as Anthropic first-party', async () => {
    const { isFirstPartyAnthropicBaseUrl } = await import(
      './providers.js?openrouter'
    )

    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

    expect(isFirstPartyAnthropicBaseUrl()).toBe(false)
  })
})

describe('isOpenRouterAnthropicBaseUrl', () => {
  test('returns true for the OpenRouter Anthropic-compatible host', async () => {
    const { isOpenRouterAnthropicBaseUrl } = await import(
      './providers.js?openrouter-helper'
    )

    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

    expect(isOpenRouterAnthropicBaseUrl()).toBe(true)
  })
})

describe('isOpenRouterCompatibleEndpoint', () => {
  test('treats the implicit default backend as OpenRouter', async () => {
    const { isOpenRouterCompatibleEndpoint } = await import(
      './providers.js?openrouter-default'
    )

    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.OPENROUTER_BASE_URL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_DEFAULT_MODEL
    delete process.env.USER_TYPE
    delete process.env.USE_STAGING_OAUTH

    expect(isOpenRouterCompatibleEndpoint()).toBe(true)
  })

  test('disables OpenRouter routing for ant staging oauth', async () => {
    const { isOpenRouterCompatibleEndpoint } = await import(
      './providers.js?openrouter-staging'
    )

    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = '1'

    expect(isOpenRouterCompatibleEndpoint()).toBe(false)
  })

  test('prefers explicit OpenRouter config over ant staging oauth', async () => {
    const { isOpenRouterCompatibleEndpoint } = await import(
      './providers.js?openrouter-staging-explicit'
    )

    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = '1'
    process.env.OPENROUTER_API_KEY = 'or-test-key'

    expect(isOpenRouterCompatibleEndpoint()).toBe(true)
  })

  test('prefers OpenRouter when explicit OpenRouter config is present even if ANTHROPIC_BASE_URL is set', async () => {
    const { isOpenRouterCompatibleEndpoint } = await import(
      './providers.js?openrouter-explicit'
    )

    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
    process.env.OPENROUTER_API_KEY = 'or-test-key'

    expect(isOpenRouterCompatibleEndpoint()).toBe(true)
  })
})
