import { MODEL_ALIASES } from './aliases.js'
import { isModelAllowed } from './modelAllowlist.js'
import {
  getOpenRouterModelCatalog,
  getOpenRouterModelSelectionIssue,
} from './openrouterCatalog.js'

const validModelCache = new Set<string>()

export async function validateModel(
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  const normalizedModel = model.trim()

  if (!normalizedModel) {
    return { valid: false, error: 'Model name cannot be empty' }
  }

  if (!isModelAllowed(normalizedModel)) {
    return {
      valid: false,
      error: `Model '${normalizedModel}' is not in the list of available models`,
    }
  }

  if (validModelCache.has(normalizedModel)) {
    return { valid: true }
  }

  try {
    const catalog = await getOpenRouterModelCatalog()
    const catalogEntry = catalog.find(entry => entry.id === normalizedModel)
    if (catalogEntry) {
      const selectionIssue = getOpenRouterModelSelectionIssue(catalogEntry)
      if (selectionIssue) {
        return {
          valid: false,
          error: selectionIssue,
        }
      }

      validModelCache.add(normalizedModel)
      return { valid: true }
    }

    const lowerModel = normalizedModel.toLowerCase()
    if ((MODEL_ALIASES as readonly string[]).includes(lowerModel)) {
      return { valid: true }
    }

    return {
      valid: false,
      error: `Model '${normalizedModel}' not found`,
    }
  } catch (error) {
    return handleValidationError(error)
  }
}

function handleValidationError(
  error: unknown,
): { valid: boolean; error: string } {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return {
    valid: false,
    error: `Unable to validate model: ${errorMessage}`,
  }
}
