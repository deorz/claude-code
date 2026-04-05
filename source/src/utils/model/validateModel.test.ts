import { afterEach, describe, expect, mock, test } from 'bun:test'
import { resetOpenRouterCatalogCache } from './openrouterCatalog.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  resetOpenRouterCatalogCache()
  globalThis.fetch = originalFetch
  mock.restore()
})

describe('validateModel', () => {
  test('accepts a model present in the loaded catalog', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
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
          ],
        }),
        { status: 200 },
      )

    const { validateModel } = await import(
      `./validateModel.js?catalog-hit=${Date.now()}`
    )

    const result = await validateModel('openai/gpt-5')

    expect(result).toEqual({ valid: true })
  })

  test('rejects a model blocked by the allowlist before catalog lookup', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => false,
    }))

    globalThis.fetch = async () => {
      throw new Error('catalog should not be queried')
    }

    const { validateModel } = await import(
      `./validateModel.js?allowlist-reject=${Date.now()}`
    )

    const result = await validateModel('openai/gpt-5')

    expect(result).toEqual({
      valid: false,
      error: "Model 'openai/gpt-5' is not in the list of available models",
    })
  })

  test('accepts known aliases after a catalog miss', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))

    const fetchCalls: Array<string> = []
    globalThis.fetch = async (input: string | URL | Request) => {
      fetchCalls.push(String(input))
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }

    const { validateModel } = await import(
      `./validateModel.js?alias=${Date.now()}`
    )

    const result = await validateModel('opus')

    expect(result).toEqual({ valid: true })
    expect(fetchCalls).toEqual(['https://openrouter.ai/api/v1/models'])
  })

  test('rejects an empty model string', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))

    const { validateModel } = await import(
      `./validateModel.js?empty=${Date.now()}`
    )

    const result = await validateModel('   ')

    expect(result).toEqual({
      valid: false,
      error: 'Model name cannot be empty',
    })
  })

  test('rejects models that do not support tool use', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'google/gemma-4-31b-it',
              name: 'Gemma',
              supported_parameters: ['temperature'],
            },
          ],
        }),
        { status: 200 },
      )

    const { validateModel } = await import(
      `./validateModel.js?toolless=${Date.now()}`
    )

    const result = await validateModel('google/gemma-4-31b-it')

    expect(result).toEqual({
      valid: false,
      error:
        "Model 'google/gemma-4-31b-it' is available on OpenRouter, but it does not support tool use, which Claude Code requires.",
    })
  })

  test('rejects expired models', async () => {
    mock.module('./modelAllowlist.js', () => ({
      isModelAllowed: () => true,
    }))

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'qwen/qwen3.6-plus:free',
              name: 'Qwen',
              supported_parameters: ['tools'],
              expiration_date: '2000-01-01',
            },
          ],
        }),
        { status: 200 },
      )

    const { validateModel } = await import(
      `./validateModel.js?expired=${Date.now()}`
    )

    const result = await validateModel('qwen/qwen3.6-plus:free')

    expect(result).toEqual({
      valid: false,
      error:
        "Model 'qwen/qwen3.6-plus:free' is no longer available on OpenRouter. Pick a different model.",
    })
  })
})
