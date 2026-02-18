# @0nork/cr0n-engine

**Federated AI Closed Learning Loop** — Multi-model optimization engine with adaptive weight learning.

The core innovation: a **federated AI approach** where multiple models (Claude, OpenAI, Gemini, Grok) compete, and the system learns which model performs best per task type. More models connected = faster convergence.

## Installation

```bash
npm install @0nork/cr0n-engine
```

## Quick Start

```typescript
import { createEngine } from '@0nork/cr0n-engine';

const engine = createEngine({
  models: {
    claude: { apiKey: process.env.ANTHROPIC_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    gemini: { apiKey: process.env.GOOGLE_AI_KEY },
    grok:   { apiKey: process.env.XAI_API_KEY },
  },
  weights: savedContentWeights,      // From previous cycle (optional)
  modelWeights: savedModelWeights,   // From previous cycle (optional)
  maxTasksPerRun: 50,
});

const result = await engine.runCycle({
  pages: pageDataArray,
  completedActions: pastActions,
});

// result.plan          — Ranked tasks with AI-generated briefs
// result.weights       — Updated content weights (save for next cycle)
// result.modelWeights  — Updated model weights (save for next cycle)
// result.modelStats    — Per-model performance dashboard
// result.learningLog   — What changed and why
```

## Two-Dimensional Learning

### Dimension 1: Content Weights
Which metrics matter most for scoring opportunities:
```
{ impressions: 0.20, position: 0.20, ctrGap: 0.20, conversions: 0.20, freshness: 0.20 }
```
Adjusted per cycle based on action outcomes.

### Dimension 2: Model Weights (per bucket)
Which AI model produces best results for each task type:
```
CTR_FIX:           { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 }
STRIKING_DISTANCE: { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 }
```
Starts equal. After evaluating outcomes, converges — e.g. "Claude is best for CTR_FIX, Gemini for LOCAL_BOOST."

## Why More Models = Faster Learning

| Models | Perspectives/Cycle | Learning Speed |
|--------|-------------------|----------------|
| 1      | 1                 | Linear         |
| 2      | 2                 | 2x             |
| 4      | 4                 | 4x hypothesis testing per evaluation window |

## Architecture

```
src/
├── core/           — Types, constants, config
├── engine/         — Scoring, bucketing, analysis
├── federation/     — Multi-model orchestration
│   ├── adapters/   — Claude, OpenAI, Gemini, Grok
│   ├── router      — Task-to-model routing
│   ├── consensus   — Weighted aggregation
│   └── model-weights
├── briefs/         — Content brief generation
├── learning/       — Dual-dimension weight learning
└── data/           — GSC/GA4 data normalization
```

## 5 Action Buckets

| Bucket | Trigger | Action |
|--------|---------|--------|
| CTR_FIX | High impressions, low CTR | Meta/intro rewrite |
| STRIKING_DISTANCE | Positions 4-10 | Content expansion |
| RELEVANCE_REBUILD | Positions 11-50, stale | Full refresh |
| LOCAL_BOOST | Local intent | Location optimization |
| MONITOR | Top 3 positions | Protect rankings |

## API

### `createEngine(config)`
Creates an engine instance with available models.

### `engine.runCycle(input)`
Full cycle: evaluate past actions → score & classify → federate across models → learn → return plan.

### `engine.analyze(pages)`
Local-only analysis without federation (fast, no API calls).

### `engine.federateBrief(page, bucket)`
Generate a single federated brief for a specific page.

## Dependencies

- `ai` — Vercel AI SDK unified interface
- `@ai-sdk/anthropic` — Claude adapter
- `@ai-sdk/openai` — OpenAI + Grok adapter
- `@ai-sdk/google` — Gemini adapter

Zero external runtime dependencies beyond the AI SDKs.

## License

MIT
