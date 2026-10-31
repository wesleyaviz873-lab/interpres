import type { OpenCodeModel, ProviderInfo } from './api'

export type ModelOption = {
  id: string
  label: string
  provider: string
  providerId: string
  providerLabel: string
  badge: 'API' | 'Local'
}

export type ModelGroup = {
  providerId: string
  label: string
  models: ModelOption[]
}

const SUGGESTED: Record<string, Array<{ model: string; label: string }>> = {
  openai: [
    { model: 'gpt-4.1', label: 'GPT-4.1' },
    { model: 'gpt-4o', label: 'GPT-4o' },
    { model: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  anthropic: [
    { model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { model: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { model: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
  google: [
    { model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  openrouter: [
    { model: 'openrouter/auto', label: 'OpenRouter Auto' },
    { model: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { model: 'openai/gpt-4.1', label: 'GPT-4.1' },
  ],
  opencode: [
    { model: 'deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
    { model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    { model: 'glm-5.3', label: 'GLM 5.3' },
  ],
}

export function buildModelOptions(
  providers: ProviderInfo[],
  ollamaModels: string[],
  opencodeModels: OpenCodeModel[] = [],
): ModelOption[] {
  const options: ModelOption[] = []

  for (const provider of providers) {
    if (!provider.configured) continue

    if (provider.id === 'ollama') {
      for (const model of ollamaModels) {
        options.push({
          id: `ollama:${model}`,
          label: model,
          provider: provider.label,
          providerId: provider.id,
          providerLabel: provider.label,
          badge: 'Local',
        })
      }
      continue
    }

    if (provider.id === 'opencode' && opencodeModels.length > 0) {
      for (const item of opencodeModels) {
        options.push({
          id: `opencode:${item.id}`,
          label: item.label || item.id,
          provider: item.vendor ? `${provider.label} · ${item.vendor}` : provider.label,
          providerId: provider.id,
          providerLabel: provider.label,
          badge: 'API',
        })
      }
      continue
    }

    for (const item of SUGGESTED[provider.id] ?? []) {
      options.push({
        id: `${provider.id}:${item.model}`,
        label: item.label,
        provider: provider.label,
        providerId: provider.id,
        providerLabel: provider.label,
        badge: 'API',
      })
    }
  }

  return options
}

export function groupModelOptions(options: ModelOption[]): ModelGroup[] {
  const groups: ModelGroup[] = []
  const index = new Map<string, ModelGroup>()
  for (const option of options) {
    let group = index.get(option.providerId)
    if (!group) {
      group = { providerId: option.providerId, label: option.providerLabel, models: [] }
      index.set(option.providerId, group)
      groups.push(group)
    }
    group.models.push(option)
  }
  return groups
}
