import React, { useCallback, useState } from 'react'
import { Box, Text } from '../ink.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { logError } from '../utils/log.js'
import { saveOpenRouterApiKey } from '../utils/openRouterAuth.js'
import { Dialog } from './design-system/Dialog.js'
import TextInput from './TextInput.js'

type Props = {
  initialValue?: string
  onDone: (saved: boolean) => void
}

export function OpenRouterApiKeyPrompt({
  initialValue = '',
  onDone,
}: Props): React.ReactNode {
  const [apiKey, setApiKey] = useState(initialValue)
  const [cursorOffset, setCursorOffset] = useState(initialValue.length)
  const [error, setError] = useState<string | null>(null)
  const { columns } = useTerminalSize()

  const handleSubmit = useCallback(
    async (value?: string) => {
      const nextApiKey = (value ?? apiKey).trim()
      if (!nextApiKey) {
        setError('Enter an OpenRouter API key.')
        return
      }

      try {
        await saveOpenRouterApiKey(nextApiKey)
        onDone(true)
      } catch (err) {
        logError(err)
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to save the API key.',
        )
      }
    },
    [apiKey, onDone],
  )

  return (
    <Dialog
      title="OpenRouter API key"
      color="permission"
      onCancel={() => onDone(false)}
    >
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Enter your OpenRouter API key. Anthropic-compatible keys still work
          for now, and the value will be saved locally so you are not asked
          again.
        </Text>
        {error ? <Text color="error">{error}</Text> : null}
        <TextInput
          value={apiKey}
          onChange={value => {
            setApiKey(value)
            setError(null)
          }}
          onPaste={value => {
            setApiKey(value)
            setError(null)
          }}
          onSubmit={value => handleSubmit(value)}
          focus={true}
          showCursor={true}
          mask="*"
          placeholder="sk-or-v1-..."
          columns={columns}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
    </Dialog>
  )
}
