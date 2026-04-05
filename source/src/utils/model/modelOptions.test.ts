import { afterEach, describe, expect, mock, test } from 'bun:test'
import { resetOpenRouterCatalogCache } from './openrouterCatalog.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  resetOpenRouterCatalogCache()
  globalThis.fetch = originalFetch
  mock.restore()
})

describe('buildOpenRouterModelOptions', () => {
  test('creates picker entries from the OpenRouter catalog', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))
    mock.module('../config.js', () => ({
      getGlobalConfig: () => ({
        additionalModelOptionsCache: [],
      }),
    }))

    const { buildOpenRouterModelOptions } = await import(
      `./modelOptions.js?build-options=${Date.now()}`
    )

    const options = buildOpenRouterModelOptions([
      {
        id: 'openai/gpt-5',
        displayName: 'GPT-5',
        description: 'Flagship reasoning model',
        contextLength: 131072,
        supportedParameters: ['tools'],
      },
      {
        id: 'google/gemma-4-31b-it',
        displayName: 'Gemma',
        description: 'Does not support tools',
        supportedParameters: ['temperature'],
      },
    ])

    expect(options).toEqual([
      {
        value: 'openai/gpt-5',
        label: 'GPT-5',
        description: 'Flagship reasoning model',
        contextLength: 131072,
      },
    ])
  })
})

describe('model option formatting', () => {
  test('formats context lengths and compact display parts', async () => {
    const {
      formatContextLengthDisplay,
      formatModelOptionDisplayParts,
    } = await import(`./modelOptions.js?format-parts=${Date.now()}`)

    expect(formatContextLengthDisplay(131072)).toBe('128k')
    expect(formatModelOptionDisplayParts({ label: 'GPT-5', contextLength: 131072 })).toEqual({
      label: 'GPT-5',
      badge: '128k',
    })
  })
})

describe('getModelOptions', () => {
  test('preserves bootstrap-provided additional model options', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))
    mock.module('../config.js', () => ({
      getGlobalConfig: () => ({
        additionalModelOptionsCache: [
          {
            value: 'custom/deployment',
            label: 'Custom deployment',
            description: 'Bootstrap-provided model',
          },
        ],
      }),
    }))
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-5',
              name: 'GPT-5',
              description: 'Flagship reasoning model',
              supported_parameters: ['tools'],
            },
            {
              id: 'google/gemma-4-31b-it',
              name: 'Gemma',
              description: 'Does not support tools',
              supported_parameters: ['temperature'],
            },
          ],
        }),
        { status: 200 },
      )

    const { getModelOptions } = await import(
      `./modelOptions.js?get-options=${Date.now()}`
    )

    const options = await getModelOptions()

    expect(options).toEqual([
      {
        value: null,
        label: 'Default (recommended)',
        description: 'Use the default model',
        descriptionForModel: 'Use the default model',
      },
      {
        value: 'openai/gpt-5',
        label: 'GPT-5',
        description: 'Flagship reasoning model',
      },
      {
        value: 'custom/deployment',
        label: 'Custom deployment',
        description: 'Bootstrap-provided model',
      },
    ])
  })
})

describe('getFallbackModelOptions', () => {
  test('returns default plus bootstrap-provided additional options', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))
    mock.module('../config.js', () => ({
      getGlobalConfig: () => ({
        additionalModelOptionsCache: [
          {
            value: 'custom/deployment',
            label: 'Custom deployment',
            description: 'Bootstrap-provided model',
          },
        ],
      }),
    }))

    const { getFallbackModelOptions } = await import(
      `./modelOptions.js?fallback-options=${Date.now()}`
    )

    expect(getFallbackModelOptions()).toEqual([
      {
        value: null,
        label: 'Default (recommended)',
        description: 'Use the default model',
        descriptionForModel: 'Use the default model',
      },
      {
        value: 'custom/deployment',
        label: 'Custom deployment',
        description: 'Bootstrap-provided model',
      },
    ])
  })
})
