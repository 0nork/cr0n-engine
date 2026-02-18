// ============================================================
// cr0n-engine CLI — File Writer
// Writes .cr0n/brain.json, .cr0n/config.json, updates .gitignore
// ============================================================

import { writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AIBrain } from '../core/types.js'
import { DEFAULT_WEIGHTS, DEFAULT_MODEL_WEIGHTS } from '../core/constants.js'

export interface EngineConfigFile {
  models: Record<string, { envVar: string }>
  weights: typeof DEFAULT_WEIGHTS
  modelWeights: typeof DEFAULT_MODEL_WEIGHTS
  maxTasksPerRun: number
}

function buildConfigFile(brain: AIBrain): EngineConfigFile {
  const models: Record<string, { envVar: string }> = {
    [brain.models.primary]: { envVar: brain.models.apiKeyEnvVar },
  }

  return {
    models,
    weights: { ...DEFAULT_WEIGHTS },
    modelWeights: { ...DEFAULT_MODEL_WEIGHTS },
    maxTasksPerRun: 50,
  }
}

function updateGitignore(rootDir: string): boolean {
  const gitignorePath = join(rootDir, '.gitignore')

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '.cr0n/\n', 'utf-8')
    return true
  }

  const content = readFileSync(gitignorePath, 'utf-8')
  if (content.includes('.cr0n')) {
    return false
  }

  const suffix = content.endsWith('\n') ? '' : '\n'
  appendFileSync(gitignorePath, `${suffix}.cr0n/\n`, 'utf-8')
  return true
}

export function writeBrainFiles(rootDir: string, brain: AIBrain): { brainPath: string; configPath: string; gitignoreUpdated: boolean } {
  const cr0nDir = join(rootDir, '.cr0n')
  mkdirSync(cr0nDir, { recursive: true })

  const brainPath = join(cr0nDir, 'brain.json')
  writeFileSync(brainPath, JSON.stringify(brain, null, 2) + '\n', 'utf-8')

  const config = buildConfigFile(brain)
  const configPath = join(cr0nDir, 'config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')

  const gitignoreUpdated = updateGitignore(rootDir)

  return {
    brainPath: '.cr0n/brain.json',
    configPath: '.cr0n/config.json',
    gitignoreUpdated,
  }
}
