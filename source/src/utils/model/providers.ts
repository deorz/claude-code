import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'

export type APIProvider = 'firstParty'

export function getAPIProvider(): APIProvider {
  return 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

function hasExplicitOpenRouterConfig(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_ANTHROPIC_BASE_URL ||
    process.env.OPENROUTER_DEFAULT_MODEL ||
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.OPENROUTER_X_TITLE
  )
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }

  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}

export function isOpenRouterAnthropicBaseUrl(): boolean {
  const baseUrl =
    process.env.OPENROUTER_ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return false
  }

  try {
    const url = new URL(baseUrl)
    return (
      url.host === 'openrouter.ai' &&
      url.pathname.startsWith('/api')
    )
  } catch {
    return false
  }
}

function isTruthyEnvVar(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase().trim())
}

export function isOpenRouterCompatibleEndpoint(): boolean {
  if (
    process.env.USER_TYPE === 'ant' &&
    isTruthyEnvVar(process.env.USE_STAGING_OAUTH)
  ) {
    return false
  }

  const baseUrl =
    process.env.OPENROUTER_ANTHROPIC_BASE_URL ||
    (hasExplicitOpenRouterConfig()
      ? 'https://openrouter.ai/api'
      : process.env.ANTHROPIC_BASE_URL) ||
    'https://openrouter.ai/api'

  try {
    const url = new URL(baseUrl)
    return (
      url.host === 'openrouter.ai' &&
      url.pathname.startsWith('/api')
    )
  } catch {
    return false
  }
}
