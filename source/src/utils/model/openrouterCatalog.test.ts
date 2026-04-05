import { describe, expect, test } from 'bun:test'
import {
  getOpenRouterModelCatalog,
  getOpenRouterModelSelectionIssue,
  normalizeOpenRouterCatalogResponse,
  resetOpenRouterCatalogCache,
} from './openrouterCatalog.js'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('normalizeOpenRouterCatalogResponse', () => {
  test('maps OpenRouter response entries into picker options', () => {
    const result = normalizeOpenRouterCatalogResponse({
      data: [
        {
          id: 'openai/gpt-5',
          name: 'GPT-5',
          description: 'Flagship reasoning model',
          context_length: 400000,
        },
      ],
    })

    expect(result).toEqual([
      {
        id: 'openai/gpt-5',
        displayName: 'GPT-5',
        description: 'Flagship reasoning model',
        contextLength: 400000,
        supportedParameters: [],
        expirationDate: undefined,
      },
    ])
  })

  test('falls back to id when name is missing', () => {
    const result = normalizeOpenRouterCatalogResponse({
      data: [{ id: 'anthropic/claude-sonnet-4-6' }],
    })

    expect(result[0]).toEqual({
      id: 'anthropic/claude-sonnet-4-6',
      displayName: 'anthropic/claude-sonnet-4-6',
      description: undefined,
      contextLength: undefined,
      supportedParameters: [],
      expirationDate: undefined,
    })
  })
})

describe('getOpenRouterModelSelectionIssue', () => {
  test('rejects models that do not support tool use', () => {
    expect(
      getOpenRouterModelSelectionIssue({
        id: 'google/gemma-4-31b-it',
        displayName: 'Gemma',
        supportedParameters: ['temperature'],
      }),
    ).toBe(
      "Model 'google/gemma-4-31b-it' is available on OpenRouter, but it does not support tool use, which Claude Code requires.",
    )
  })

  test('rejects expired models', () => {
    expect(
      getOpenRouterModelSelectionIssue(
        {
          id: 'qwen/qwen3.6-plus:free',
          displayName: 'Qwen',
          supportedParameters: ['tools'],
          expirationDate: '2026-04-03',
        },
        new Date('2026-04-04T00:00:00Z'),
      ),
    ).toBe(
      "Model 'qwen/qwen3.6-plus:free' is no longer available on OpenRouter. Pick a different model.",
    )
  })
})

describe('getOpenRouterModelCatalog', () => {
  test('fetches the OpenRouter catalog once and returns defensive copies', async () => {
    resetOpenRouterCatalogCache()

    const fetchCalls: Array<string> = []
    const fetchImpl = async (input: string) => {
      fetchCalls.push(input)
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-5',
              name: 'GPT-5',
              description: 'Flagship reasoning model',
              context_length: 400000,
              supported_parameters: ['tools'],
            },
          ],
        }),
        { status: 200 },
      )
    }

    const first = await getOpenRouterModelCatalog(fetchImpl as typeof fetch)
    first[0]!.displayName = 'mutated'
    first.push({
      id: 'bad/value',
      displayName: 'bad/value',
      supportedParameters: [],
    })

    const second = await getOpenRouterModelCatalog(fetchImpl as typeof fetch)

    expect(fetchCalls).toEqual(['https://openrouter.ai/api/v1/models'])
    expect(second).toEqual([
      {
        id: 'openai/gpt-5',
        displayName: 'GPT-5',
        description: 'Flagship reasoning model',
        contextLength: 400000,
        supportedParameters: ['tools'],
        expirationDate: undefined,
      },
    ])
  })

  test('deduplicates concurrent cold-start fetches', async () => {
    resetOpenRouterCatalogCache()

    const deferred = createDeferred<Response>()
    const fetchCalls: Array<string> = []
    const fetchImpl = async (input: string) => {
      fetchCalls.push(input)
      return deferred.promise
    }

    const firstRequest = getOpenRouterModelCatalog(fetchImpl as typeof fetch)
    const secondRequest = getOpenRouterModelCatalog(fetchImpl as typeof fetch)

    deferred.resolve(
      new Response(
        JSON.stringify({
          data: [{ id: 'openai/gpt-5', name: 'GPT-5' }],
        }),
        { status: 200 },
      ),
    )

    const [first, second] = await Promise.all([firstRequest, secondRequest])

    expect(fetchCalls).toEqual(['https://openrouter.ai/api/v1/models'])
    expect(first).toEqual(second)
  })

  test('reuses cache until reset clears it', async () => {
    resetOpenRouterCatalogCache()

    let fetchCount = 0
    const fetchImpl = async () => {
      fetchCount += 1
      return new Response(
        JSON.stringify({
          data: [{ id: 'openai/gpt-5', supported_parameters: ['tools'] }],
        }),
        { status: 200 },
      )
    }

    await getOpenRouterModelCatalog(fetchImpl as typeof fetch)
    await getOpenRouterModelCatalog(fetchImpl as typeof fetch)
    resetOpenRouterCatalogCache()
    await getOpenRouterModelCatalog(fetchImpl as typeof fetch)

    expect(fetchCount).toBe(2)
  })

  test('throws a non-OK error message that includes the status code', async () => {
    resetOpenRouterCatalogCache()

    const fetchImpl = async () =>
      new Response('nope', {
        status: 503,
      })

    await expect(
      getOpenRouterModelCatalog(fetchImpl as typeof fetch),
    ).rejects.toThrow('Failed to load OpenRouter models: 503')
  })

  test('rejects malformed 200 responses and does not poison the cache', async () => {
    resetOpenRouterCatalogCache()

    let callCount = 0
    const fetchImpl = async () => {
      callCount += 1

      if (callCount === 1) {
        return new Response(JSON.stringify({}), { status: 200 })
      }

      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-5',
              name: 'GPT-5',
              supported_parameters: ['tools'],
            },
          ],
        }),
        { status: 200 },
      )
    }

    await expect(
      getOpenRouterModelCatalog(fetchImpl as typeof fetch),
    ).rejects.toThrow('Malformed OpenRouter models payload')

    const result = await getOpenRouterModelCatalog(fetchImpl as typeof fetch)

    expect(callCount).toBe(2)
    expect(result).toEqual([
      {
        id: 'openai/gpt-5',
        displayName: 'GPT-5',
        description: undefined,
        contextLength: undefined,
        supportedParameters: ['tools'],
        expirationDate: undefined,
      },
    ])
  })

  test('sanitizes malformed entry fields in a valid payload', async () => {
    resetOpenRouterCatalogCache()

    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 123,
              name: 'invalid model',
              description: 'should be dropped',
              context_length: '400000',
            },
            {
              id: 'openai/gpt-5',
              name: { label: 'GPT-5' },
              description: { text: 'invalid' },
              context_length: '400000',
              supported_parameters: ['tools'],
            },
          ],
        }),
        { status: 200 },
      )

    const result = await getOpenRouterModelCatalog(fetchImpl as typeof fetch)

    expect(result).toEqual([
      {
        id: 'openai/gpt-5',
        displayName: 'openai/gpt-5',
        description: undefined,
        contextLength: undefined,
        supportedParameters: ['tools'],
        expirationDate: undefined,
      },
    ])
  })
})
