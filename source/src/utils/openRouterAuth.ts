import { saveApiKey } from './auth.js'
import { saveGlobalConfig } from './config.js'

export async function saveOpenRouterApiKey(apiKey: string): Promise<void> {
  await saveApiKey(apiKey)

  process.env.OPENROUTER_API_KEY = apiKey

  saveGlobalConfig(current => ({
    ...current,
    primaryApiKey: apiKey,
    env: current.env,
  }))
}
