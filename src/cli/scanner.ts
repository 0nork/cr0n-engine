// ============================================================
// cr0n-engine CLI — Project Scanner
// Scans target project structure, detects frameworks, maps files
// Pure local — no AI calls
// ============================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import type { ProjectScan } from '../core/types.js'

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit',
  '.astro', '.cache', '.vercel', '.output', 'coverage', '__pycache__',
  '.turbo', '.parcel-cache', 'out',
])

const CONFIG_FILES = [
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'remix.config.js', 'remix.config.ts',
  'astro.config.mjs', 'astro.config.ts',
  'svelte.config.js', 'svelte.config.ts',
  'vite.config.ts', 'vite.config.js',
  'nuxt.config.ts', 'nuxt.config.js',
  'tailwind.config.js', 'tailwind.config.ts',
  'postcss.config.js', 'postcss.config.mjs',
  '.env', '.env.local', '.env.example',
  'vercel.json', 'netlify.toml',
  'docker-compose.yml', 'Dockerfile',
  'sanity.config.ts', 'sanity.config.js', 'sanity.cli.ts',
  'drizzle.config.ts', 'prisma/schema.prisma',
]

const FRAMEWORK_DETECTORS: Record<string, (pkg: Record<string, any>) => boolean> = {
  'nextjs': (pkg) => !!(pkg.dependencies?.next || pkg.devDependencies?.next),
  'remix': (pkg) => !!(pkg.dependencies?.['@remix-run/node'] || pkg.dependencies?.['@remix-run/react']),
  'astro': (pkg) => !!(pkg.dependencies?.astro || pkg.devDependencies?.astro),
  'sveltekit': (pkg) => !!(pkg.devDependencies?.['@sveltejs/kit']),
  'nuxt': (pkg) => !!(pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt),
  'express': (pkg) => !!(pkg.dependencies?.express),
  'fastify': (pkg) => !!(pkg.dependencies?.fastify),
  'hono': (pkg) => !!(pkg.dependencies?.hono),
}

const INTEGRATION_DETECTORS: Record<string, (pkg: Record<string, any>) => boolean> = {
  'supabase': (pkg) => !!(pkg.dependencies?.['@supabase/supabase-js'] || pkg.dependencies?.['@supabase/ssr']),
  'stripe': (pkg) => !!(pkg.dependencies?.stripe),
  'vercel-ai': (pkg) => !!(pkg.dependencies?.ai),
  'prisma': (pkg) => !!(pkg.dependencies?.['@prisma/client'] || pkg.devDependencies?.prisma),
  'drizzle': (pkg) => !!(pkg.dependencies?.['drizzle-orm']),
  'tailwind': (pkg) => !!(pkg.devDependencies?.tailwindcss || pkg.dependencies?.tailwindcss),
  'sanity': (pkg) => !!(pkg.dependencies?.sanity || pkg.dependencies?.['@sanity/client']),
  'firebase': (pkg) => !!(pkg.dependencies?.firebase || pkg.dependencies?.['firebase-admin']),
  'mongoose': (pkg) => !!(pkg.dependencies?.mongoose),
  'analytics': (pkg) => !!(pkg.dependencies?.['@vercel/analytics'] || pkg.dependencies?.['@google-analytics/data']),
}

function readJsonSafe(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function walkDir(dir: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return []

  const results: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        const subDir = join(dir, entry.name)
        results.push(subDir)
        results.push(...walkDir(subDir, depth + 1, maxDepth))
      }
    }
  } catch {
    // Permission denied or similar
  }
  return results
}

function countFilesByExtension(dir: string, depth: number, maxDepth: number): Record<string, number> {
  const counts: Record<string, number> = {}

  function walk(d: string, currentDepth: number) {
    if (currentDepth > maxDepth) return
    try {
      const entries = readdirSync(d, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            walk(join(d, entry.name), currentDepth + 1)
          }
        } else {
          const ext = extname(entry.name).toLowerCase()
          if (ext) {
            counts[ext] = (counts[ext] || 0) + 1
          }
        }
      }
    } catch {
      // Skip
    }
  }

  walk(dir, depth)
  return counts
}

function detectFramework(pkg: Record<string, any> | null): string {
  if (!pkg) return 'unknown'

  for (const [framework, detector] of Object.entries(FRAMEWORK_DETECTORS)) {
    if (detector(pkg)) return framework
  }

  return 'node'
}

function detectIntegrations(pkg: Record<string, any> | null): string[] {
  if (!pkg) return []

  const found: string[] = []
  for (const [integration, detector] of Object.entries(INTEGRATION_DETECTORS)) {
    if (detector(pkg)) found.push(integration)
  }
  return found
}

function detectPackageManager(rootDir: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (existsSync(join(rootDir, 'bun.lockb')) || existsSync(join(rootDir, 'bun.lock'))) return 'bun'
  if (existsSync(join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(rootDir, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function detectLanguage(rootDir: string, filesByExt: Record<string, number>): 'typescript' | 'javascript' {
  if (existsSync(join(rootDir, 'tsconfig.json'))) return 'typescript'
  const tsFiles = (filesByExt['.ts'] || 0) + (filesByExt['.tsx'] || 0)
  const jsFiles = (filesByExt['.js'] || 0) + (filesByExt['.jsx'] || 0)
  return tsFiles > jsFiles ? 'typescript' : 'javascript'
}

function findConfigFiles(rootDir: string): string[] {
  const found: string[] = []
  for (const file of CONFIG_FILES) {
    if (existsSync(join(rootDir, file))) {
      found.push(file)
    }
  }
  return found
}

function findEntryPoints(rootDir: string, framework: string): string[] {
  const entries: string[] = []

  // Framework-specific entry points
  const candidates: string[] = []

  switch (framework) {
    case 'nextjs':
      candidates.push(
        'app/layout.tsx', 'app/layout.ts', 'app/layout.js',
        'app/page.tsx', 'app/page.ts',
        'pages/_app.tsx', 'pages/_app.js',
        'pages/index.tsx', 'pages/index.js',
        'src/app/layout.tsx', 'src/app/page.tsx',
      )
      // Scan for API routes
      for (const apiDir of ['app/api', 'src/app/api', 'pages/api']) {
        if (existsSync(join(rootDir, apiDir))) {
          entries.push(apiDir + '/')
        }
      }
      break
    case 'remix':
      candidates.push('app/root.tsx', 'app/entry.server.tsx', 'app/entry.client.tsx')
      break
    case 'astro':
      candidates.push('src/pages/index.astro', 'astro.config.mjs', 'astro.config.ts')
      break
    case 'sveltekit':
      candidates.push('src/routes/+layout.svelte', 'src/routes/+page.svelte')
      break
    default:
      candidates.push(
        'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
        'src/server.ts', 'src/server.js', 'src/app.ts', 'src/app.js',
        'index.ts', 'index.js', 'server.ts', 'server.js',
      )
  }

  for (const candidate of candidates) {
    if (existsSync(join(rootDir, candidate))) {
      entries.push(candidate)
    }
  }

  return entries
}

export function scanProject(rootDir: string): ProjectScan {
  const packageJson = readJsonSafe(join(rootDir, 'package.json'))
  const tsconfig = readJsonSafe(join(rootDir, 'tsconfig.json'))

  const filesByExtension = countFilesByExtension(rootDir, 0, 5)
  const framework = detectFramework(packageJson)

  return {
    rootDir,
    packageJson,
    tsconfig,
    framework,
    language: detectLanguage(rootDir, filesByExtension),
    packageManager: detectPackageManager(rootDir),
    directories: walkDir(rootDir, 0, 3).map(d => d.replace(rootDir + '/', '')),
    filesByExtension,
    configFiles: findConfigFiles(rootDir),
    entryPoints: findEntryPoints(rootDir, framework),
    integrations: detectIntegrations(packageJson),
  }
}
