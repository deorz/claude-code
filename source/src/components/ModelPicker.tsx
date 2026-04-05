import capitalize from 'lodash-es/capitalize.js'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import {
  FAST_MODE_MODEL_DISPLAY,
  isFastModeAvailable,
  isFastModeCooldown,
  isFastModeEnabled,
} from 'src/utils/fastMode.js'
import { Box, Text } from '../ink.js'
import { useKeybindings } from '../keybindings/useKeybinding.js'
import { useAppState, useSetAppState } from '../state/AppState.js'
import {
  convertEffortValueToLevel,
  type EffortLevel,
  getDefaultEffortForModel,
  modelSupportsEffort,
  modelSupportsMaxEffort,
  resolvePickerEffortPersistence,
  toPersistableEffort,
} from '../utils/effort.js'
import {
  getDefaultMainLoopModel,
  type ModelSetting,
  modelDisplayString,
  parseUserSpecifiedModel,
} from '../utils/model/model.js'
import {
  getFallbackModelOptions,
  getModelOptions,
  type ModelOption,
} from '../utils/model/modelOptions.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { Select } from './CustomSelect/index.js'
import { Byline } from './design-system/Byline.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { Pane } from './design-system/Pane.js'
import { effortLevelToSymbol } from './EffortIndicator.js'

export type Props = {
  initial: string | null
  sessionModel?: ModelSetting
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void
  onCancel?: () => void
  isStandaloneCommand?: boolean
  showFastModeNotice?: boolean
  headerText?: string
  skipSettingsWrite?: boolean
}

type SelectOption = ModelOption & {
  value: string
}

const NO_PREFERENCE = '__NO_PREFERENCE__'

export function ModelPicker({
  initial,
  sessionModel,
  onSelect,
  onCancel,
  isStandaloneCommand,
  showFastModeNotice,
  headerText,
  skipSettingsWrite,
}: Props) {
  const setAppState = useSetAppState()
  const exitState = useExitOnCtrlCDWithKeybindings()
  const initialValue = initial === null ? NO_PREFERENCE : initial
  const [focusedValue, setFocusedValue] = useState<string | undefined>(
    initialValue,
  )
  const isFastMode = useAppState(s => (isFastModeEnabled() ? s.fastMode : false))
  const [hasToggledEffort, setHasToggledEffort] = useState(false)
  const effortValue = useAppState(s => s.effortValue)
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined,
  )
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    void getModelOptions()
      .then(options => {
        if (cancelled) {
          return
        }

        setSelectOptions(options.map(toSelectOption))
        setLoadError(null)
        setIsLoading(false)
      })
      .catch(error => {
        if (cancelled) {
          return
        }

        setSelectOptions(getFallbackModelOptions().map(toSelectOption))
        setLoadError(error instanceof Error ? error.message : String(error))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const optionsWithInitial = useMemo(() => {
    if (isLoading || initial === null) {
      return selectOptions
    }

    if (selectOptions.some(option => option.value === initial)) {
      return selectOptions
    }

    return [
      ...selectOptions,
      {
        value: initial,
        label: modelDisplayString(initial),
        description: 'Current model',
      },
    ]
  }, [initial, isLoading, selectOptions])

  const initialFocusValue = useMemo(() => {
    if (optionsWithInitial.some(option => option.value === initialValue)) {
      return initialValue
    }

    return optionsWithInitial[0]?.value
  }, [initialValue, optionsWithInitial])

  const visibleCount = Math.min(10, optionsWithInitial.length)
  const hiddenCount = Math.max(0, optionsWithInitial.length - visibleCount)

  const focusedModelName = optionsWithInitial.find(
    option => option.value === focusedValue,
  )?.label
  const focusedModel = resolveOptionModel(focusedValue)
  const focusedSupportsEffort = focusedModel
    ? modelSupportsEffort(focusedModel)
    : false
  const focusedSupportsMax = focusedModel
    ? modelSupportsMaxEffort(focusedModel)
    : false
  const focusedDefaultEffort = getDefaultEffortLevelForOption(focusedValue)
  const displayEffort =
    effort === 'max' && !focusedSupportsMax ? 'high' : effort

  useEffect(() => {
    if (
      !hasToggledEffort &&
      effortValue === undefined &&
      focusedValue !== undefined
    ) {
      setEffort(getDefaultEffortLevelForOption(focusedValue))
    }
  }, [effortValue, focusedValue, hasToggledEffort])

  const handleFocus = (value: string) => {
    setFocusedValue(value)
    if (!hasToggledEffort && effortValue === undefined) {
      setEffort(getDefaultEffortLevelForOption(value))
    }
  }

  const handleCycleEffort = (direction: 'left' | 'right') => {
    if (!focusedSupportsEffort) {
      return
    }

    setEffort(previous =>
      cycleEffortLevel(
        previous ?? focusedDefaultEffort,
        direction,
        focusedSupportsMax,
      ),
    )
    setHasToggledEffort(true)
  }

  useKeybindings(
    {
      'modelPicker:decreaseEffort': () => handleCycleEffort('left'),
      'modelPicker:increaseEffort': () => handleCycleEffort('right'),
    },
    { context: 'ModelPicker' },
  )

  function handleSelect(value: string) {
    logEvent('tengu_model_command_menu_effort', {
      effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    if (!skipSettingsWrite) {
      const effortLevel = resolvePickerEffortPersistence(
        effort,
        getDefaultEffortLevelForOption(value),
        getSettingsForSource('userSettings')?.effortLevel,
        hasToggledEffort,
      )
      const persistable = toPersistableEffort(effortLevel)
      if (persistable !== undefined) {
        updateSettingsForSource('userSettings', {
          effortLevel: persistable,
        })
      }
      setAppState(previous => ({
        ...previous,
        effortValue: effortLevel,
      }))
    }

    const selectedModel = resolveOptionModel(value)
    const selectedEffort =
      hasToggledEffort &&
      selectedModel &&
      modelSupportsEffort(selectedModel)
        ? effort
        : undefined

    if (value === NO_PREFERENCE) {
      onSelect(null, selectedEffort)
      return
    }

    onSelect(value, selectedEffort)
  }

  const helperText =
    headerText ??
    'Choose any model exposed by OpenRouter. Applies to this session and future sessions.'
  const cancelHandler = onCancel ?? (() => {})

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold>
          Select model
        </Text>
        <Text dimColor>{helperText}</Text>
        {sessionModel ? (
          <Text dimColor>
            Currently using {modelDisplayString(sessionModel)} for this session
            {' '} (set by plan mode). Selecting a model will undo this.
          </Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {isLoading ? (
          <Text dimColor>Loading OpenRouter models…</Text>
        ) : optionsWithInitial.length > 0 ? (
          <>
            <Box flexDirection="column">
              <Select
                defaultValue={initialValue}
                defaultFocusValue={initialFocusValue}
                options={optionsWithInitial}
                onChange={handleSelect}
                onFocus={handleFocus}
                onCancel={cancelHandler}
                visibleOptionCount={visibleCount}
              />
            </Box>
            {hiddenCount > 0 ? (
              <Box paddingLeft={3}>
                <Text dimColor>and {hiddenCount} more…</Text>
              </Box>
            ) : null}
          </>
        ) : (
          <Text dimColor>No OpenRouter models available.</Text>
        )}
      </Box>

      {loadError ? (
        <Box marginBottom={1}>
          <Text color="error">Failed to load models: {loadError}</Text>
        </Box>
      ) : null}

      <Box marginBottom={1} flexDirection="column">
        {focusedSupportsEffort ? (
          <Text dimColor>
            <EffortLevelIndicator effort={displayEffort} />{' '}
            {capitalize(displayEffort)} effort
            {displayEffort === focusedDefaultEffort ? ' (default)' : ''}{' '}
            <Text color="subtle">← → to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ''}
          </Text>
        )}
      </Box>

      {isFastModeEnabled() ? (
        showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor>
              Fast mode is <Text bold>ON</Text> and available with{' '}
              {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models
              turn off fast mode.
            </Text>
          </Box>
        ) : isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor>
              Use <Text bold>/fast</Text> to turn on Fast mode (
              {FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null
      ) : null}

      {isStandaloneCommand ? (
        <Text dimColor italic>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint
                action="select:cancel"
                context="Select"
                fallback="Esc"
                description="exit"
              />
            </Byline>
          )}
        </Text>
      ) : null}
    </Box>
  )

  if (!isStandaloneCommand) {
    return content
  }

  return <Pane color="permission">{content}</Pane>
}

function toSelectOption(option: ModelOption): SelectOption {
  return {
    ...option,
    value: option.value === null ? NO_PREFERENCE : option.value,
  }
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  return value === NO_PREFERENCE
    ? getDefaultMainLoopModel()
    : parseUserSpecifiedModel(value)
}

function EffortLevelIndicator({ effort }: { effort: EffortLevel | undefined }) {
  return <Text color={effort ? 'claude' : 'subtle'}>{effortLevelToSymbol(effort ?? 'low')}</Text>
}

function cycleEffortLevel(
  current: EffortLevel,
  direction: 'left' | 'right',
  includeMax: boolean,
): EffortLevel {
  const levels: EffortLevel[] = includeMax
    ? ['low', 'medium', 'high', 'max']
    : ['low', 'medium', 'high']
  const index = levels.indexOf(current)
  const currentIndex = index !== -1 ? index : levels.indexOf('high')

  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!
  }

  return levels[(currentIndex - 1 + levels.length) % levels.length]!
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel()
  const defaultValue = getDefaultEffortForModel(resolved)
  return defaultValue !== undefined
    ? convertEffortValueToLevel(defaultValue)
    : 'high'
}
