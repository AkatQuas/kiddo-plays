#!/usr/bin/env node

// Load .env file if present — runs before ANY SDK import
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Disable OpenAI's built-in tracing (we have our own trace system)
process.env.OPENAI_AGENTS_DISABLE_TRACING = '1';

// Set default model (overridable via OPENAI_DEFAULT_MODEL env)
// if (!process.env.OPENAI_DEFAULT_MODEL) {
//   process.env.OPENAI_DEFAULT_MODEL = 'deepseek-v4-flash';
// }

import { TeamOrchestrator } from './orchestrator.js';
import { configureProvider } from './provider.js';
import type { FinalReport } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

function printDivider(char = '=', length = 60) {
  console.log(char.repeat(length));
}

function printReport(report: FinalReport) {
  printDivider();
  console.log('📋 FINAL REPORT');
  printDivider();

  console.log('\n📝 SUMMARY');
  console.log(report.naturalLanguageSummary);

  console.log('\n📊 STRUCTURED DETAILS');
  printDivider('-', 40);
  for (const detail of report.structuredDetails) {
    console.log(`\n[${detail.taskId}] ${detail.taskDescription}`);
    console.log(
      `  Output: ${detail.output.slice(0, 500)}${detail.output.length > 500 ? '...' : ''}`
    );
  }

  console.log('\n📈 EXECUTION SUMMARY');
  printDivider('-', 40);
  const s = report.executionSummary;
  console.log(`  Total tasks:     ${s.totalTasks}`);
  console.log(`  Passed tasks:    ${s.passedTasks}`);
  console.log(`  Retried tasks:   ${s.retriedTasks}`);
  console.log(`  Total duration:  ${(s.totalDurationMs / 1000).toFixed(2)}s`);
}

function printTraceLogs(traceLogs: any[]) {
  printDivider();
  console.log('🔍 TRACE LOGS (timeline)');
  printDivider();

  if (traceLogs.length === 0) {
    console.log('  (no trace logs)');
    return;
  }

  for (let i = 0; i < traceLogs.length; i++) {
    const log = traceLogs[i];
    const elapsed =
      new Date(log.timestamp).getTime() -
      new Date(traceLogs[0].timestamp).getTime();
    const elapsedStr = `+${(elapsed / 1000).toFixed(1)}s`;

    const statusIcon =
      log.status === 'error' ? '❌' : log.status === 'retry' ? '🔄' : '✅';
    const retryTag =
      log.retryCount != null ? ` [retry #${log.retryCount}]` : '';

    console.log(`\n${statusIcon} [${elapsedStr}] ${log.stepName}${retryTag}`);
    console.log(`   Role:       ${log.role}`);
    console.log(`   Duration:   ${log.durationMs}ms`);
    console.log(`   Input:      ${log.inputSummary}`);
    console.log(`   Output:     ${log.outputSummary}`);
    if (log.error) {
      console.log(`   Error:      ${log.error}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const userInput = args.join(' ');

  if (!userInput) {
    console.error('Usage: agent-small-team <your task description>');
    console.error(
      'Example: agent-small-team "Analyze the README of this project and summarize its structure"'
    );
    process.exit(1);
  }

  console.log(`\n🚀 Agent Small Team starting...`);
  console.log(`📝 Task: ${userInput}`);
  console.log(
    `⚙️  Config: maxRetries=${DEFAULT_CONFIG.maxRetries}, maxParallelWorkers=${DEFAULT_CONFIG.maxParallelWorkers}`
  );
  console.log(`🔧 Model: ${process.env.OPENAI_DEFAULT_MODEL}`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY not set.');
    console.error('   Copy .env.example to .env and add your key.');
    process.exit(1);
  }

  // Configure the model provider (Chat Completions API, not Responses API)
  configureProvider();
  console.log();

  const orchestrator = new TeamOrchestrator(userInput, DEFAULT_CONFIG);
  const { report, traceLogs } = await orchestrator.run();

  // Save full trace + raw outputs to file
  const traceDir = resolve(process.cwd(), '.agent-team-logs');
  if (!existsSync(traceDir)) mkdirSync(traceDir, { recursive: true });
  const logFilePath = await (orchestrator as any).global.saveToFile(traceDir);
  console.log(`📁 Full trace saved to: ${logFilePath}`);

  console.log();

  if (report) {
    printReport(report);
  } else {
    printDivider();
    console.log('❌ WORKFLOW FAILED');
    printDivider();
    console.log(
      'The team workflow encountered an error. Check trace logs below.'
    );
  }

  console.log();
  printTraceLogs(traceLogs);
  console.log();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
