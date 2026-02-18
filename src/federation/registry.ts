// ============================================================
// cr0n-engine — Model Registry
// Register, discover, and manage available model adapters
// ============================================================

import type { ModelId, EngineConfig } from '../core/types.js'
import type { ModelAdapter } from './types.js'
import { ClaudeAdapter } from './adapters/claude.js'
import { OpenAIAdapter } from './adapters/openai.js'
import { GeminiAdapter } from './adapters/gemini.js'
import { GrokAdapter } from './adapters/grok.js'

export class ModelRegistry {
  private adapters: Map<ModelId, ModelAdapter> = new Map()

  /**
   * Initialize registry from engine config
   */
  static fromConfig(config: EngineConfig): ModelRegistry {
    const registry = new ModelRegistry()

    if (config.models.claude?.apiKey) {
      registry.register(new ClaudeAdapter(
        config.models.claude.apiKey,
        config.models.claude.model
      ))
    }

    if (config.models.openai?.apiKey) {
      registry.register(new OpenAIAdapter(
        config.models.openai.apiKey,
        config.models.openai.model
      ))
    }

    if (config.models.gemini?.apiKey) {
      registry.register(new GeminiAdapter(
        config.models.gemini.apiKey,
        config.models.gemini.model
      ))
    }

    if (config.models.grok?.apiKey) {
      registry.register(new GrokAdapter(
        config.models.grok.apiKey,
        config.models.grok.model,
        config.models.grok.baseURL
      ))
    }

    return registry
  }

  register(adapter: ModelAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  unregister(id: ModelId): void {
    this.adapters.delete(id)
  }

  get(id: ModelId): ModelAdapter | undefined {
    return this.adapters.get(id)
  }

  getAvailable(): ModelAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.available)
  }

  getAvailableIds(): ModelId[] {
    return this.getAvailable().map(a => a.id)
  }

  getAll(): ModelAdapter[] {
    return Array.from(this.adapters.values())
  }

  has(id: ModelId): boolean {
    return this.adapters.has(id) && (this.adapters.get(id)?.available ?? false)
  }

  count(): number {
    return this.getAvailable().length
  }
}
