import { afterEach, describe, expect, mock, test } from 'bun:test'

const originalEnv = { ...process.env }
const originalStdoutWrite = process.stdout.write.bind(process.stdout)
const originalExit = process.exit.bind(process)

afterEach(() => {
  process.env = { ...originalEnv }
  process.stdout.write = originalStdoutWrite
  process.exit = originalExit
  mock.restore()
})

describe('authStatus OpenRouter compatibility', () => {
  test('does not report OPENROUTER_API_KEY as active auth on ant staging oauth', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = '1'
    process.env.OPENROUTER_API_KEY = 'or-test-key'

    mock.module('../../commands/logout/logout.js', () => ({
      clearAuthRelatedCaches: async () => {},
      performLogout: async () => {},
    }))
    mock.module('../../services/analytics/index.js', () => ({
      logEvent: () => {},
    }))
    mock.module('../../services/api/errorUtils.js', () => ({
      getSSLErrorHint: () => null,
    }))
    mock.module('../../services/api/firstTokenDate.js', () => ({
      fetchAndStoreClaudeCodeFirstTokenDate: async () => {},
    }))
    mock.module('../../services/api/client.js', () => ({
      getResolvedAnthropicBaseUrl: () => 'https://api-staging.anthropic.com',
    }))
    mock.module('../../services/oauth/client.js', () => ({
      createAndStoreApiKey: async () => null,
      fetchAndStoreUserRoles: async () => {},
      refreshOAuthToken: async () => {},
      shouldUseClaudeAIAuth: () => false,
      storeOAuthAccountInfo: () => {},
    }))
    mock.module('../../services/oauth/getOauthProfile.js', () => ({
      getOauthProfileFromOauthToken: async () => null,
    }))
    mock.module('../../services/oauth/index.js', () => ({
      OAuthService: class OAuthService {},
    }))
    const authModuleMock = () => ({
      checkAndRefreshOAuthTokenIfNeeded: async () => {},
      clearOAuthTokenCache: () => {},
      getAnthropicApiKey: () => null,
      getAnthropicApiKeyWithSource: () => ({ key: null, source: 'none' }),
      getApiKeyFromApiKeyHelper: async () => null,
      getAuthTokenSource: () => ({ source: 'none', hasToken: false }),
      getClaudeAIOAuthTokens: () => null,
      getOauthAccountInfo: () => null,
      getSubscriptionType: () => null,
      isClaudeAISubscriber: () => false,
      isEnvApiKeySource: () => false,
      isUsing3PServices: () => false,
      refreshAndGetAwsCredentials: async () => null,
      refreshGcpCredentialsIfNeeded: async () => {},
      saveOAuthTokensIfNeeded: () => ({ warning: null }),
      validateForceLoginOrg: () => {},
    })
    mock.module('../../utils/auth.js', authModuleMock)
    mock.module('../../utils/auth.ts', authModuleMock)
    mock.module('src/utils/auth.js', authModuleMock)
    mock.module('src/utils/auth.ts', authModuleMock)
    mock.module(
      '/Users/deorz/Developer/Typescript/claude-code/source/src/utils/auth.ts',
      authModuleMock,
    )
    mock.module('../../utils/config.js', () => ({
      saveGlobalConfig: async () => {},
    }))
    mock.module('../../utils/debug.js', () => ({
      isDebugToStdErr: () => false,
      logForDebugging: () => {},
    }))
    mock.module('../../utils/envUtils.js', () => ({
      getAWSRegion: () => 'us-east-1',
      getVertexRegionForModel: () => 'us-east5',
      isEnvTruthy: () => false,
      isRunningOnHomespace: () => false,
    }))
    mock.module('../../utils/errors.js', () => ({
      errorMessage: (message: string) => message,
    }))
    mock.module('../../utils/log.js', () => ({
      logError: () => {},
    }))
    mock.module('../../utils/model/providers.js', () => ({
      getAPIProvider: () => 'firstParty',
      isOpenRouterCompatibleEndpoint: () => false,
    }))
    mock.module('../../utils/settings/settings.js', () => ({
      getInitialSettings: () => ({}),
    }))
    mock.module('../../utils/slowOperations.js', () => ({
      jsonStringify: JSON.stringify,
    }))
    mock.module('../../utils/status.js', () => ({
      buildAccountProperties: () => [],
      buildAPIProviderProperties: () => [],
    }))

    let stdout = ''
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    }) as typeof process.stdout.write
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`)
    }) as typeof process.exit

    const { authStatus } = await import(`./auth.js?status=${Date.now()}`)

    try {
      await authStatus({})
      throw new Error('expected authStatus to exit')
    } catch (error) {
      expect((error as Error).message).toBe('EXIT:1')
    }

    expect(JSON.parse(stdout)).toEqual({
      loggedIn: false,
      authMethod: 'none',
      apiProvider: 'firstParty',
      baseUrl: 'https://api-staging.anthropic.com',
    })
  })
})
