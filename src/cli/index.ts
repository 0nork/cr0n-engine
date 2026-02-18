#!/usr/bin/env node
// ============================================================
// cr0n-engine CLI — AI Brain Generator
// Usage: cr0n init | cr0n scan | cr0n status
// ============================================================

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pickModel, getApiKey, getEnvVar, getModelLabel, getProviderLabel } from './prompts.js'
import { scanProject } from './scanner.js'
import { generateBrain } from './brain.js'
import { writeBrainFiles } from './writer.js'
import type { AIBrain, ProjectScan } from '../core/types.js'

// ── ANSI Colors (no chalk dependency) ──
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
}

function log(msg: string) { console.log(msg) }
function success(msg: string) { log(`  ${c.green}${msg}${c.reset}`) }
function info(msg: string) { log(`  ${c.cyan}${msg}${c.reset}`) }
function warn(msg: string) { log(`  ${c.yellow}${msg}${c.reset}`) }
function error(msg: string) { log(`  ${c.red}${msg}${c.reset}`) }

function banner() {
  log('')
  log(`  ${c.bold}${c.cyan}cr0n-engine${c.reset} ${c.dim}v1.0.0${c.reset} ${c.bold}— AI Brain Generator${c.reset}`)
  log('')
}

function printScanSummary(scan: ProjectScan) {
  const totalFiles = Object.values(scan.filesByExtension).reduce((a, b) => a + b, 0)
  const topExts = Object.entries(scan.filesByExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ext, count]) => `${count} ${ext}`)
    .join(', ')

  log(`\n  ${c.bold}Step 3: Scanning project...${c.reset}\n`)
  info(`Framework:     ${scan.framework}`)
  info(`Language:      ${scan.language}`)
  info(`Files:         ${totalFiles} (${topExts})`)
  info(`Entry points:  ${scan.entryPoints.length > 0 ? scan.entryPoints.join(', ') : 'none detected'}`)
  info(`Integrations:  ${scan.integrations.length > 0 ? scan.integrations.join(', ') : 'none detected'}`)
  info(`Config files:  ${scan.configFiles.length}`)
}

function printBrainSummary(brain: AIBrain, files: { brainPath: string; configPath: string; gitignoreUpdated: boolean }) {
  log(`\n  ${c.bold}Step 5: Writing files...${c.reset}\n`)
  success(`Created ${files.brainPath}`)
  success(`Created ${files.configPath}`)
  if (files.gitignoreUpdated) {
    success(`Updated .gitignore`)
  }

  log(`\n  ${c.bold}${c.green}Your AI Brain is ready.${c.reset}\n`)

  log(`  ${c.bold}Next steps:${c.reset}`)
  for (let i = 0; i < brain.nextSteps.length && i < 5; i++) {
    log(`    ${i + 1}. ${brain.nextSteps[i]}`)
  }

  const otherModels = brain.models.recommended.slice(0, 2)
  if (otherModels.length > 0) {
    log(`\n  ${c.dim}Add more models for faster learning:${c.reset}`)
    for (const m of otherModels) {
      log(`    ${c.dim}$ npx cr0n add ${m}${c.reset}`)
    }
  }
  log('')
}

// ── Commands ──

async function cmdInit() {
  banner()

  // Step 1: Pick model
  const modelId = await pickModel()
  const modelLabel = getModelLabel(modelId)
  const providerLabel = getProviderLabel(modelId)

  // Step 2: Get API key
  const apiKey = await getApiKey(modelId)
  const envVar = getEnvVar(modelId)

  // Step 3: Scan project
  const rootDir = resolve(process.cwd())
  const scan = scanProject(rootDir)
  printScanSummary(scan)

  // Step 4: Generate brain
  log(`\n  ${c.bold}Step 4: Generating AI Brain...${c.reset}\n`)
  info(`${modelLabel} is analyzing your project...`)

  try {
    const brain = await generateBrain(modelId, apiKey, scan, envVar)

    // Step 5: Write files
    const files = writeBrainFiles(rootDir, brain)
    printBrainSummary(brain, files)
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('invalid')) {
      error(`API key verification failed.`)
      error(`The ${providerLabel} API rejected your key.`)
      error(`Check that your key is valid and has the correct permissions.`)
    } else {
      error(`Brain generation failed: ${msg}`)
    }
    process.exit(1)
  }
}

function cmdScan() {
  banner()
  log(`  ${c.bold}Scanning project...${c.reset}\n`)

  const rootDir = resolve(process.cwd())
  const scan = scanProject(rootDir)

  printScanSummary(scan)

  log(`\n  ${c.bold}Directories:${c.reset}`)
  for (const dir of scan.directories.slice(0, 20)) {
    log(`    ${c.dim}${dir}${c.reset}`)
  }
  if (scan.directories.length > 20) {
    log(`    ${c.dim}... and ${scan.directories.length - 20} more${c.reset}`)
  }
  log('')
}

function cmdStatus() {
  banner()

  const rootDir = resolve(process.cwd())
  const brainPath = join(rootDir, '.cr0n', 'brain.json')

  if (!existsSync(brainPath)) {
    warn('No AI Brain found in this project.')
    info('Run `npx cr0n init` to generate one.')
    log('')
    return
  }

  try {
    const brain: AIBrain = JSON.parse(readFileSync(brainPath, 'utf-8'))
    log(`  ${c.bold}AI Brain Status${c.reset}\n`)
    info(`Generated by:  ${brain.generatedBy}`)
    info(`Generated at:  ${brain.generatedAt}`)
    info(`Framework:     ${brain.project.framework}`)
    info(`Language:      ${brain.project.language}`)
    info(`Primary model: ${brain.models.primary}`)
    info(`Config path:   ${brain.integration.configPath}`)
    info(`API route:     ${brain.integration.apiRoutePath}`)
    info(`Pattern:       ${brain.integration.recommendedPattern}`)

    log(`\n  ${c.bold}Capabilities:${c.reset}`)
    for (const cap of brain.capabilities.slice(0, 5)) {
      log(`    - ${cap}`)
    }
  } catch {
    error('Failed to read brain.json')
  }
  log('')
}

function cmdHelp() {
  banner()
  log(`  ${c.bold}Commands:${c.reset}`)
  log(`    init     Generate an AI Brain for this project`)
  log(`    scan     Scan project structure (no AI calls)`)
  log(`    status   Show current brain configuration`)
  log(`    help     Show this help message`)
  log('')
  log(`  ${c.bold}Usage:${c.reset}`)
  log(`    npx cr0n init`)
  log(`    npx cr0n scan`)
  log(`    npx cr0n status`)
  log('')
}

// ── Main ──

const command = process.argv[2] || 'help'

switch (command) {
  case 'init':
    cmdInit().catch(err => {
      error(`Fatal: ${err.message || err}`)
      process.exit(1)
    })
    break
  case 'scan':
    cmdScan()
    break
  case 'status':
    cmdStatus()
    break
  case 'help':
  case '--help':
  case '-h':
    cmdHelp()
    break
  default:
    error(`Unknown command: ${command}`)
    cmdHelp()
    process.exit(1)
}
