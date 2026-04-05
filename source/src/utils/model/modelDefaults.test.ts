import { afterEach, describe, expect, mock, test } from 'bun:test'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  modelModulePromise = undefined
  mock.restore()
})

let modelModulePromise:
  | Promise<typeof import('./model.js')>
  | undefined

function encodeQueryValue(value: string | null | undefined): string {
  return encodeURIComponent(value ?? 'unset')
}

function loadModelModule(options?: {
  modelOverride?: string | null
  settingsModel?: string | null
  isMaxSubscriber?: boolean
  isTeamPremiumSubscriber?: boolean
  userType?: string
}) {
  const {
    modelOverride,
    settingsModel,
    isMaxSubscriber = false,
    isTeamPremiumSubscriber = false,
    userType,
  } = options ?? {}

  if (userType !== undefined) {
    process.env.USER_TYPE = userType
  }

  if (!modelModulePromise) {
    mock.module('../../bootstrap/state.js', () => ({
      getMainLoopModelOverride: () => modelOverride,
      getIsNonInteractiveSession: () => false,
      getSessionId: () => 'session',
    }))
    mock.module('../auth.js', () => ({
      getSubscriptionType: () => null,
      isClaudeAISubscriber: () => false,
      isMaxSubscriber: () => isMaxSubscriber,
      isProSubscriber: () => false,
      isTeamPremiumSubscriber: () => isTeamPremiumSubscriber,
    }))
    mock.module('../context.js', () => ({
      has1mContext: (value: string) => value.toLowerCase().endsWith('[1m]'),
      is1mContextDisabled: () => false,
      modelSupports1M: () => false,
    }))
    mock.module('./modelStrings.js', () => ({
      getModelStrings: () => ({
        opus40: 'anthropic/claude-opus-4',
        opus41: 'anthropic/claude-opus-4-1',
        opus45: 'anthropic/claude-opus-4-5',
        opus46: 'anthropic/claude-opus-4-6',
        sonnet45: 'claude-sonnet-4-5-20250929',
        sonnet46: 'claude-sonnet-4-6-20251001',
        haiku45: 'anthropic/claude-haiku-4-5',
      }),
      resolveOverriddenModel: (model: string) => model,
    }))
    mock.module('../modelCost.js', () => ({
      formatModelPricing: () => '$0',
      getOpus46CostTier: () => ({ inputTokens: 0 }),
    }))
    mock.module('../settings/settings.js', () => ({
      getSettings_DEPRECATED: () =>
        settingsModel === undefined ? {} : { model: settingsModel },
    }))
    mock.module('../../constants/figures.js', () => ({
      LIGHTNING_BOLT: '!',
    }))
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))
    mock.module('./aliases.js', () => ({
      isModelAlias: (value: string) =>
        ['best', 'haiku', 'opus', 'opusplan', 'sonnet'].includes(value),
    }))
    mock.module('../stringUtils.js', () => ({
      capitalize: (value: string) =>
        value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1),
    }))
    modelModulePromise = import(
      `./model.js?override=${encodeQueryValue(modelOverride)}&settings=${encodeQueryValue(settingsModel)}&max=${encodeQueryValue(String(isMaxSubscriber))}&team=${encodeQueryValue(String(isTeamPremiumSubscriber))}&userType=${encodeQueryValue(userType)}`
    )
  }

  return modelModulePromise
}

describe('OpenRouter defaults', () => {
  test('uses the current selected model for helper paths on the OpenRouter-compatible path', async () => {
    const { getSmallFastModel } = await loadModelModule({
      settingsModel: 'openai/gpt-5',
    })
    process.env.OPENROUTER_API_KEY = 'or-test-key'
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.OPENROUTER_ANTHROPIC_BASE_URL

    expect(getSmallFastModel()).toBe('openai/gpt-5')
  })

  test('uses OPENROUTER default model override on the OpenRouter-compatible path', async () => {
    const { getDefaultMainLoopModel } = await loadModelModule()
    process.env.OPENROUTER_DEFAULT_MODEL = 'openai/gpt-5'
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.OPENROUTER_ANTHROPIC_BASE_URL

    expect(getDefaultMainLoopModel()).toBe('openai/gpt-5')
  })

  test('keeps the Anthropic default model on the Anthropic-first-party path', async () => {
    const { getDefaultMainLoopModel } = await loadModelModule()
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
    delete process.env.OPENROUTER_DEFAULT_MODEL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_ANTHROPIC_BASE_URL

    expect(getDefaultMainLoopModel()).toBe('claude-sonnet-4-6-20251001')
  })

  test('keeps built-in subscriber defaults separate from user-specified values', async () => {
    const { getDefaultMainLoopModel } = await loadModelModule({
      isMaxSubscriber: true,
      settingsModel: 'google/gemini-2.5-pro',
    })

    expect(getDefaultMainLoopModel()).toBe('anthropic/claude-opus-4-6[1m]')
  })

  test('keeps explicit model ids unchanged', async () => {
    const { parseUserSpecifiedModel } = await loadModelModule()

    expect(parseUserSpecifiedModel('google/gemini-2.5-pro')).toBe(
      'google/gemini-2.5-pro',
    )
  })

  test('returns a stable fallback default model id', async () => {
    const { getDefaultSonnetModel } = await loadModelModule()

    expect(getDefaultSonnetModel()).toBe('claude-sonnet-4-6-20251001')
  })

  test('returns marketing names for known default models', async () => {
    const { getMarketingNameForModel } = await loadModelModule()

    expect(getMarketingNameForModel('anthropic/claude-sonnet-4-6')).toBe(
      'Sonnet 4.6',
    )
  })

  test('shows generic default model copy without Claude-only wording', async () => {
    const { modelDisplayString } = await loadModelModule()

    expect(modelDisplayString(null)).toBe('Default model')
  })
})
