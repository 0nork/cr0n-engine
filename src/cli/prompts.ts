// ============================================================
// cr0n-engine CLI — Interactive Prompts
// Uses Node.js readline/promises (built-in, Node 18+)
// ============================================================

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import type { ModelId } from '../core/types.js'
import { MODEL_DEFAULTS } from '../core/constants.js'

const MODEL_OPTIONS: Array<{ id: ModelId; label: string; provider: string; keyHint: string }> = [
  { id: 'claude', label: 'Claude', provider: 'Anthropic', keyHint: 'starts with sk-ant-' },
  { id: 'openai', label: 'GPT-4o', provider: 'OpenAI', keyHint: 'starts with sk-' },
  { id: 'gemini', label: 'Gemini', provider: 'Google', keyHint: 'Google AI API key' },
  { id: 'grok', label: 'Grok', provider: 'xAI', keyHint: 'xAI API key' },
]

const ENV_VAR_MAP: Record<ModelId, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_AI_KEY',
  grok: 'XAI_API_KEY',
}

function createRl() {
  return createInterface({ input: stdin, output: stdout })
}

export async function pickModel(): Promise<ModelId> {
  const rl = createRl()

  console.log('\n  Step 1: Choose your AI model\n')
  for (let i = 0; i < MODEL_OPTIONS.length; i++) {
    const opt = MODEL_OPTIONS[i]
    console.log(`    ${i + 1}. ${opt.label.padEnd(8)} (${opt.provider})`)
  }
  console.log()

  while (true) {
    const answer = await rl.question('  Select [1-4]: ')
    const num = parseInt(answer.trim(), 10)
    if (num >= 1 && num <= 4) {
      rl.close()
      return MODEL_OPTIONS[num - 1].id
    }
    console.log('  Please enter a number between 1 and 4.')
  }
}

export async function getApiKey(modelId: ModelId): Promise<string> {
  const rl = createRl()
  const option = MODEL_OPTIONS.find(o => o.id === modelId)!

  console.log(`\n  Step 2: Enter your ${option.provider} API key`)
  console.log(`  (${option.keyHint})\n`)

  while (true) {
    const key = await rl.question('  API Key: ')
    const trimmed = key.trim()
    if (trimmed.length > 10) {
      rl.close()
      return trimmed
    }
    console.log('  Key seems too short. Please enter a valid API key.')
  }
}

export async function confirm(message: string): Promise<boolean> {
  const rl = createRl()
  const answer = await rl.question(`  ${message} [Y/n]: `)
  rl.close()
  const lower = answer.trim().toLowerCase()
  return lower === '' || lower === 'y' || lower === 'yes'
}

export function getEnvVar(modelId: ModelId): string {
  return ENV_VAR_MAP[modelId]
}

export function getModelLabel(modelId: ModelId): string {
  return MODEL_OPTIONS.find(o => o.id === modelId)?.label || modelId
}

export function getProviderLabel(modelId: ModelId): string {
  return MODEL_OPTIONS.find(o => o.id === modelId)?.provider || modelId
}
