export type OpenRouterCatalogEntry = {
  id: string
  displayName: string
  description?: string
  contextLength?: number
  supportedParameters: string[]
  expirationDate?: string
}

type OpenRouterCatalogResponse = {
  data?: Array<{
    id?: string
    name?: string
    description?: string
    context_length?: number
    supported_parameters?: unknown
    expiration_date?: unknown
  }>
}

let cachedCatalog: OpenRouterCatalogEntry[] | null = null
let catalogPromise: Promise<void> | null = null

function cloneCatalogEntries(
  entries: OpenRouterCatalogEntry[],
): OpenRouterCatalogEntry[] {
  return entries.map(entry => ({ ...entry }))
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function normalizeOpenRouterCatalogEntry(
  entry: unknown,
): OpenRouterCatalogEntry | null {
  if (typeof entry !== 'object' || entry === null) {
    return null
  }

  const rawEntry = entry as {
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    supported_parameters?: unknown
    expiration_date?: unknown
  }

  if (!isString(rawEntry.id)) {
    return null
  }

  return {
    id: rawEntry.id,
    displayName: isString(rawEntry.name) ? rawEntry.name : rawEntry.id,
    description: isString(rawEntry.description) ? rawEntry.description : undefined,
    contextLength: isNumber(rawEntry.context_length) ? rawEntry.context_length : undefined,
    supportedParameters: isStringArray(rawEntry.supported_parameters)
      ? rawEntry.supported_parameters
      : [],
    expirationDate: isString(rawEntry.expiration_date)
      ? rawEntry.expiration_date
      : undefined,
  }
}

function parseDateOnly(value: string): Date | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isOpenRouterModelExpired(
  entry: OpenRouterCatalogEntry,
  now: Date = new Date(),
): boolean {
  if (!entry.expirationDate) {
    return false
  }

  const expiration = parseDateOnly(entry.expirationDate)
  if (!expiration) {
    return false
  }

  return expiration.getTime() <= now.getTime()
}

export function getOpenRouterModelSelectionIssue(
  entry: OpenRouterCatalogEntry,
  now: Date = new Date(),
): string | undefined {
  if (!entry.supportedParameters.includes('tools')) {
    return `Model '${entry.id}' is available on OpenRouter, but it does not support tool use, which Claude Code requires.`
  }

  if (isOpenRouterModelExpired(entry, now)) {
    return `Model '${entry.id}' is no longer available on OpenRouter. Pick a different model.`
  }

  return undefined
}

export function normalizeOpenRouterCatalogResponse(
  payload: OpenRouterCatalogResponse,
): OpenRouterCatalogEntry[] {
  return (payload.data ?? [])
    .map(normalizeOpenRouterCatalogEntry)
    .filter((entry): entry is OpenRouterCatalogEntry => entry !== null)
}

function isValidOpenRouterCatalogResponse(
  payload: unknown,
): payload is OpenRouterCatalogResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as OpenRouterCatalogResponse).data)
  )
}

export function resetOpenRouterCatalogCache(): void {
  cachedCatalog = null
  catalogPromise = null
}

async function loadOpenRouterCatalog(
  fetchImpl: typeof fetch,
): Promise<void> {
  const response = await fetchImpl('https://openrouter.ai/api/v1/models')
  if (!response.ok) {
    throw new Error(`Failed to load OpenRouter models: ${response.status}`)
  }

  const payload = await response.json()
  if (!isValidOpenRouterCatalogResponse(payload)) {
    throw new Error('Malformed OpenRouter models payload')
  }

  cachedCatalog = normalizeOpenRouterCatalogResponse(payload)
}

export async function getOpenRouterModelCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterCatalogEntry[]> {
  if (cachedCatalog) {
    return cloneCatalogEntries(cachedCatalog)
  }

  if (!catalogPromise) {
    catalogPromise = loadOpenRouterCatalog(fetchImpl).finally(() => {
      catalogPromise = null
    })
  }

  await catalogPromise
  return cloneCatalogEntries(cachedCatalog ?? [])
}
