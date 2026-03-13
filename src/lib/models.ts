export interface ModelConfig {
  alias: string
  name: string
  provider: string
  description: string
  costPer1k: number
  contextWindow: number
  maxContextWindow?: number
  maxOutput: number
  supportsThinking: boolean
  supportsEffort: boolean
  supportedEffortLevels?: string[]
}

export const MODEL_CATALOG: ModelConfig[] = [
  { alias: 'haiku', name: 'anthropic/claude-haiku-3-5', provider: 'anthropic', description: 'Ultra-cheap, simple tasks', costPer1k: 0.25, contextWindow: 200000, maxOutput: 64000, supportsThinking: false, supportsEffort: false },
  { alias: 'sonnet', name: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', description: 'Standard workhorse (1M context)', costPer1k: 3.0, contextWindow: 200000, maxContextWindow: 1000000, maxOutput: 64000, supportsThinking: true, supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high'] },
  { alias: 'opus', name: 'anthropic/claude-opus-4-6', provider: 'anthropic', description: 'Premium quality (1M context)', costPer1k: 15.0, contextWindow: 200000, maxContextWindow: 1000000, maxOutput: 128000, supportsThinking: true, supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high', 'max'] },
  { alias: 'deepseek', name: 'ollama/deepseek-r1:14b', provider: 'ollama', description: 'Local reasoning (free)', costPer1k: 0.0, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
  { alias: 'groq-fast', name: 'groq/llama-3.1-8b-instant', provider: 'groq', description: '840 tok/s, ultra fast', costPer1k: 0.05, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
  { alias: 'groq', name: 'groq/llama-3.3-70b-versatile', provider: 'groq', description: 'Fast + quality balance', costPer1k: 0.59, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
  { alias: 'kimi', name: 'moonshot/kimi-k2.5', provider: 'moonshot', description: 'Alternative provider', costPer1k: 1.0, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
  { alias: 'venice-llama-3.3-70b', name: 'venice/llama-3.3-70b', provider: 'venice', description: 'Venice AI Llama 3.3 70B', costPer1k: 0.7, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
  { alias: 'minimax', name: 'minimax/minimax-m2.1', provider: 'minimax', description: 'Cost-effective (1/10th price), strong coding', costPer1k: 0.3, contextWindow: 128000, maxOutput: 8192, supportsThinking: false, supportsEffort: false },
]

export function getModelByAlias(alias: string): ModelConfig | undefined {
  return MODEL_CATALOG.find(m => m.alias === alias)
}

export function getModelByName(name: string): ModelConfig | undefined {
  return MODEL_CATALOG.find(m => m.name === name)
}

export function getAllModels(): ModelConfig[] {
  return [...MODEL_CATALOG]
}
