import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getCompatibleApiKeyEnvWithSource } from '../../utils/apiKeyEnv.js'
const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  mock.restore()
})

function mockClientDeps(options?: {
  isEnvTruthy?: boolean
  oauthBaseUrl?: string
  isClaudeAISubscriber?: boolean
  oauthToken?: string
}) {
  const {
    isEnvTruthy = false,
    oauthBaseUrl = 'https://api.anthropic.com',
    isClaudeAISubscriber = false,
    oauthToken = null,
  } = options ?? {}

  let lastClientConfig: unknown
  class Anthropic {
    constructor(config: unknown) {
      lastClientConfig = config
    }
  }
  mock.module('@anthropic-ai/sdk', () => ({ default: Anthropic }))
  mock.module('src/utils/auth.js', () => ({
    checkAndRefreshOAuthTokenIfNeeded: async () => {},
    clearOAuthTokenCache: () => {},
    getAnthropicApiKey: () => process.env.OPENROUTER_API_KEY ?? null,
    getAnthropicApiKeyWithSource: () => ({ key: null, source: 'none' }),
    getApiKeyFromApiKeyHelper: async () => null,
    getAuthTokenSource: () => ({ source: 'none', hasToken: false }),
    getClaudeAIOAuthTokens: () =>
      oauthToken ? { accessToken: oauthToken, scopes: [] } : null,
    getOauthAccountInfo: () => null,
    getSubscriptionType: () => null,
    isClaudeAISubscriber: () => isClaudeAISubscriber,
    isEnvApiKeySource: () => false,
    isUsing3PServices: () => false,
    refreshAndGetAwsCredentials: async () => null,
    refreshGcpCredentialsIfNeeded: async () => {},
    saveOAuthTokensIfNeeded: () => ({ warning: null }),
    validateForceLoginOrg: () => {},
  }))
  mock.module('src/utils/http.js', () => ({ getUserAgent: () => 'test' }))
  mock.module('src/utils/model/model.js', () => ({
    getSmallFastModel: () => 'small-fast',
  }))
  mock.module('src/utils/model/providers.js', () => ({
    getAPIProvider: () => 'firstParty',
    getOpenRouterCompatibleBaseUrl: () => 'https://openrouter.ai/api',
    isFirstPartyAnthropicBaseUrl: () => true,
    isOpenRouterCompatibleEndpoint: () => true,
  }))
  mock.module('src/utils/proxy.js', () => ({
    getProxyFetchOptions: () => ({}),
  }))
  mock.module('../../bootstrap/state.js', () => ({
    getIsNonInteractiveSession: () => false,
    getSessionId: () => 'session',
  }))
  mock.module('../../constants/oauth.js', () => ({
    getOauthConfig: () => ({ BASE_API_URL: oauthBaseUrl }),
  }))
  mock.module('../../utils/debug.js', () => ({
    isDebugToStdErr: () => false,
    logForDebugging: () => {},
  }))
  mock.module('../../utils/envUtils.js', () => ({
    getAWSRegion: () => 'us-east-1',
    getVertexRegionForModel: () => 'us-east5',
    isEnvTruthy: () => isEnvTruthy,
    isRunningOnHomespace: () => false,
  }))

  return {
    getLastClientConfig: () => lastClientConfig,
  }
}

describe('OpenRouter compatible transport defaults', () => {
  test('uses the OpenRouter anthropic-compatible endpoint by default', async () => {
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.OPENROUTER_BASE_URL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_DEFAULT_MODEL

    mockClientDeps()

    const {
      getOpenRouterCompatibleBaseUrl,
      getResolvedAnthropicBaseUrl,
    } = await import(
      `./client.js?base-url=${Date.now()}`
    )

    expect(getOpenRouterCompatibleBaseUrl()).toBe(
      'https://openrouter.ai/api',
    )
    expect(getResolvedAnthropicBaseUrl()).toBe(
      'https://openrouter.ai/api',
    )
  })

  test('uses the staging OAuth base URL when ant staging auth is enabled', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = '1'

    mockClientDeps({
      isEnvTruthy: true,
      oauthBaseUrl: 'https://api-staging.anthropic.com',
    })

    const { getResolvedAnthropicBaseUrl } = await import(
      `./client.js?staging=${Date.now()}`
    )

    expect(getResolvedAnthropicBaseUrl()).toBe(
      'https://api-staging.anthropic.com',
    )
  })

  test('prefers explicit OpenRouter config on the ant staging oauth path', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = '1'
    process.env.OPENROUTER_API_KEY = 'or-test-key'
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'

    expect(getCompatibleApiKeyEnvWithSource()).toEqual({
      key: 'or-test-key',
      source: 'OPENROUTER_API_KEY',
    })
  })

  test('ignores Claude OAuth tokens on the OpenRouter-compatible path', async () => {
    process.env.OPENROUTER_API_KEY = 'or-test-key'

    const deps = mockClientDeps({
      isClaudeAISubscriber: true,
      oauthToken: 'claude-oauth-token',
    })

    const { getAnthropicClient } = await import(`./client.js?oauth=${Date.now()}`)

    await getAnthropicClient({
      maxRetries: 0,
      source: 'test',
    })

    expect(deps.getLastClientConfig()).toMatchObject({
      apiKey: 'or-test-key',
      authToken: undefined,
      baseURL: 'https://openrouter.ai/api',
    })
  })
})
