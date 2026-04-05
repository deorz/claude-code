import { isOpenRouterCompatibleEndpoint } from './model/providers.js'

export type CompatibleApiKeyEnvSource =
  | 'OPENROUTER_API_KEY'
  | 'ANTHROPIC_API_KEY'

export function getCompatibleApiKeyEnvWithSource():
  | { key: string; source: CompatibleApiKeyEnvSource }
  | { key: undefined; source: undefined } {
  if (isOpenRouterCompatibleEndpoint()) {
    if (process.env.OPENROUTER_API_KEY) {
      return {
        key: process.env.OPENROUTER_API_KEY,
        source: 'OPENROUTER_API_KEY',
      }
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return {
        key: process.env.ANTHROPIC_API_KEY,
        source: 'ANTHROPIC_API_KEY',
      }
    }

    return { key: undefined, source: undefined }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      key: process.env.ANTHROPIC_API_KEY,
      source: 'ANTHROPIC_API_KEY',
    }
  }

  return { key: undefined, source: undefined }
}

export function getCompatibleApiKeyEnv(): string | undefined {
  return getCompatibleApiKeyEnvWithSource().key
}
