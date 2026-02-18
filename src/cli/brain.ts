// ============================================================
// cr0n-engine CLI — AI Brain Generator
// Uses the user's chosen AI to analyze their project
// and generate a structured integration config
// ============================================================

import type { ModelId, ProjectScan, AIBrain } from '../core/types.js'
import { MODEL_DEFAULTS } from '../core/constants.js'

function buildScanPrompt(scan: ProjectScan): string {
  const pkg = scan.packageJson
  const topExtensions = Object.entries(scan.filesByExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ')

  return `You are an AI integration architect. Analyze this project structure and determine the optimal way to integrate the cr0n-engine (a federated multi-model AI optimization engine).

PROJECT DETAILS:
- Name: ${pkg?.name || 'unknown'}
- Framework: ${scan.framework}
- Language: ${scan.language}
- Package Manager: ${scan.packageManager}
- Files by type: ${topExtensions}
- Config files found: ${scan.configFiles.join(', ') || 'none'}
- Entry points: ${scan.entryPoints.join(', ') || 'none'}
- Existing integrations: ${scan.integrations.join(', ') || 'none'}
- Key directories: ${scan.directories.slice(0, 30).join(', ')}

DEPENDENCIES:
${pkg?.dependencies ? Object.keys(pkg.dependencies).join(', ') : 'none'}

DEV DEPENDENCIES:
${pkg?.devDependencies ? Object.keys(pkg.devDependencies).slice(0, 20).join(', ') : 'none'}

Based on this project structure, determine:
1. The best location to put the engine configuration file
2. Where data sources feed in/out (API routes, server actions, etc.)
3. The best place for an API route to expose the engine
4. Where scheduled/cron tasks should go
5. The recommended integration pattern for this framework
6. What capabilities the cr0n-engine can provide for this specific project
7. Actionable next steps for the developer

Be specific to this project's actual structure and framework patterns.`
}

interface BrainAnalysis {
  project: AIBrain['project']
  integration: AIBrain['integration']
  capabilities: string[]
  nextSteps: string[]
}

async function callModel(
  modelId: ModelId,
  apiKey: string,
  prompt: string
): Promise<BrainAnalysis> {
  const { generateObject } = await import('ai')
  const { z } = await import('zod')

  const schema = z.object({
    project: z.object({
      name: z.string(),
      framework: z.string(),
      language: z.enum(['typescript', 'javascript']),
      packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']),
      entryPoints: z.array(z.string()),
    }),
    integration: z.object({
      configPath: z.string().describe('Where to put the engine config file, e.g. lib/cr0n.ts or src/lib/engine.ts'),
      dataSourcePaths: z.array(z.string()).describe('File paths where data flows in/out'),
      apiRoutePath: z.string().describe('Best path for an API route, e.g. app/api/cr0n/route.ts'),
      cronPath: z.string().describe('Best path for scheduled tasks'),
      recommendedPattern: z.string().describe('Integration pattern: api-route, server-action, cron, middleware, or standalone'),
    }),
    capabilities: z.array(z.string()).describe('What the engine can do for this specific project'),
    nextSteps: z.array(z.string()).describe('Actionable developer instructions, ordered by priority'),
  })

  let model: any

  switch (modelId) {
    case 'claude': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      const provider = createAnthropic({ apiKey })
      model = provider(MODEL_DEFAULTS.claude.model)
      break
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const provider = createOpenAI({ apiKey })
      model = provider(MODEL_DEFAULTS.openai.model)
      break
    }
    case 'gemini': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      const provider = createGoogleGenerativeAI({ apiKey })
      model = provider(MODEL_DEFAULTS.gemini.model)
      break
    }
    case 'grok': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const provider = createOpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' })
      model = provider(MODEL_DEFAULTS.grok.model)
      break
    }
  }

  const result = await generateObject({ model, schema, prompt })
  return result.object as any
}

export async function generateBrain(
  modelId: ModelId,
  apiKey: string,
  scan: ProjectScan,
  envVar: string
): Promise<AIBrain> {
  const prompt = buildScanPrompt(scan)
  const aiResult = await callModel(modelId, apiKey, prompt)

  const otherModels = (['claude', 'openai', 'gemini', 'grok'] as ModelId[]).filter(m => m !== modelId)

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedBy: modelId,
    project: aiResult.project,
    integration: aiResult.integration,
    models: {
      primary: modelId,
      apiKeyEnvVar: envVar,
      recommended: otherModels,
    },
    capabilities: aiResult.capabilities,
    nextSteps: aiResult.nextSteps,
  }
}
