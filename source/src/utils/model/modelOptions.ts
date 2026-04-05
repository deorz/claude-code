import {
  getOpenRouterModelCatalog,
  getOpenRouterModelSelectionIssue,
  type OpenRouterCatalogEntry,
} from './openrouterCatalog.js'
import { getGlobalConfig } from '../config.js'
import { isModelAllowed } from './modelAllowlist.js'

export type ModelOption = {
  value: string | null
  label: string
  description: string
  descriptionForModel?: string
}

function getDefaultOption(): ModelOption {
  return {
    value: null,
    label: 'Default (recommended)',
    description: 'Use the default model',
    descriptionForModel: 'Use the default model',
  }
}

export function buildOpenRouterModelOptions(
  entries: OpenRouterCatalogEntry[],
): ModelOption[] {
  return entries
    .filter(entry => getOpenRouterModelSelectionIssue(entry) === undefined)
    .map(entry => ({
      value: entry.id,
      label: entry.displayName,
      description: entry.description ?? entry.id,
    }))
}

function filterModelOptionsByAllowlist(options: ModelOption[]): ModelOption[] {
  return options.filter(
    option => option.value === null || isModelAllowed(option.value),
  )
}

function appendUniqueModelOptions(
  options: ModelOption[],
  additionalOptions: ModelOption[],
): ModelOption[] {
  const mergedOptions = [...options]

  for (const option of additionalOptions) {
    if (!mergedOptions.some(existing => existing.value === option.value)) {
      mergedOptions.push(option)
    }
  }

  return mergedOptions
}

function getBootstrapModelOptions(): ModelOption[] {
  return getGlobalConfig().additionalModelOptionsCache ?? []
}

function buildModelOptions(
  entries: OpenRouterCatalogEntry[],
  additionalOptions: ModelOption[] = getBootstrapModelOptions(),
): ModelOption[] {
  return appendUniqueModelOptions([
    getDefaultOption(),
    ...buildOpenRouterModelOptions(entries),
  ], additionalOptions)
}

export async function getModelOptions(): Promise<ModelOption[]> {
  const catalog = await getOpenRouterModelCatalog()
  return filterModelOptionsByAllowlist(buildModelOptions(catalog))
}

export function getFallbackModelOptions(): ModelOption[] {
  return filterModelOptionsByAllowlist(
    appendUniqueModelOptions([getDefaultOption()], getBootstrapModelOptions()),
  )
}
