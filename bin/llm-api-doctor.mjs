#!/usr/bin/env node

import process from 'node:process'
import { pathToFileURL } from 'node:url'

const DEFAULT_BASE_URL = 'https://llmhub.vip/v1'
const DEFAULT_TIMEOUT_MS = 15_000

function usage() {
  return `Usage: llm-api-doctor [options]

Read-only by default: checks GET /models. --chat, --stream and --responses
send a short model request that may consume paid tokens.

Options:
  --base-url <url>   API base URL (default: LLMHUB_BASE_URL or ${DEFAULT_BASE_URL})
  --api-key <key>    API key (prefer LLMHUB_API_KEY; never printed)
  --model <id>       Model ID (default: LLMHUB_MODEL)
  --chat             Test POST /chat/completions
  --stream           Test streaming chat; implies --chat
  --responses        Test POST /responses
  --timeout <ms>     Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --json             Print machine-readable report
  --help             Show this help
`
}

export function parseArgs(argv) {
  const args = {
    baseUrl: process.env.LLMHUB_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.LLMHUB_API_KEY || '',
    model: process.env.LLMHUB_MODEL || '',
    chat: false,
    stream: false,
    responses: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') args.help = true
    else if (arg === '--json') args.json = true
    else if (arg === '--chat') args.chat = true
    else if (arg === '--stream') {
      args.stream = true
      args.chat = true
    } else if (arg === '--responses') args.responses = true
    else if (['--base-url', '--api-key', '--model', '--timeout'].includes(arg)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`)
      index += 1
      if (arg === '--base-url') args.baseUrl = value
      else if (arg === '--api-key') args.apiKey = value
      else if (arg === '--model') args.model = value
      else args.timeoutMs = Number(value)
    } else {
      throw new Error(`unknown option: ${arg}`)
    }
  }

  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 100 || args.timeoutMs > 120_000) {
    throw new Error('--timeout must be an integer from 100 to 120000')
  }
  return args
}

function normalizeBaseUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('base URL must use http or https')
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function safeMessage(error, apiKey) {
  const message = error instanceof Error ? error.message : String(error)
  return apiKey ? message.replaceAll(apiKey, '[redacted]') : message
}

async function request(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return { response, elapsedMs: Math.round(performance.now() - startedAt) }
  } finally {
    clearTimeout(timer)
  }
}

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'llm-api-doctor/0.1.0',
  }
}

async function checkModels(args, report) {
  const check = { name: 'models', ok: false }
  try {
    const { response, elapsedMs } = await request(
      `${args.baseUrl}/models`,
      { method: 'GET', headers: headers(args.apiKey) },
      args.timeoutMs,
    )
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    const models = Array.isArray(data?.data) ? data.data.map((item) => item?.id).filter(Boolean) : []
    Object.assign(check, {
      ok: response.ok && Array.isArray(data?.data),
      status: response.status,
      elapsedMs,
      modelCount: models.length,
      requestedModelAvailable: args.model ? models.includes(args.model) : null,
    })
    if (!check.ok) check.error = `unexpected /models response (HTTP ${response.status})`
  } catch (error) {
    check.error = safeMessage(error, args.apiKey)
  }
  report.checks.push(check)
}

async function checkChat(args, report) {
  const check = { name: args.stream ? 'chat_stream' : 'chat', ok: false }
  try {
    const payload = {
      model: args.model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      stream: args.stream,
    }
    const startedAt = performance.now()
    const { response } = await request(
      `${args.baseUrl}/chat/completions`,
      { method: 'POST', headers: headers(args.apiKey), body: JSON.stringify(payload) },
      args.timeoutMs,
    )
    let firstByteMs = null
    let receivedBytes = 0
    let usagePresent = false
    if (args.stream && response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (firstByteMs === null) firstByteMs = Math.round(performance.now() - startedAt)
        receivedBytes += value.byteLength
      }
    } else {
      const text = await response.text()
      receivedBytes = Buffer.byteLength(text)
      try {
        usagePresent = Boolean(JSON.parse(text)?.usage)
      } catch {
        usagePresent = false
      }
    }
    Object.assign(check, {
      ok: response.ok && receivedBytes > 0,
      status: response.status,
      elapsedMs: Math.round(performance.now() - startedAt),
      firstByteMs,
      receivedBytes,
      usagePresent,
    })
    if (!check.ok) check.error = `chat request failed (HTTP ${response.status})`
  } catch (error) {
    check.error = safeMessage(error, args.apiKey)
  }
  report.checks.push(check)
}

async function checkResponses(args, report) {
  const check = { name: 'responses', ok: false }
  try {
    const { response, elapsedMs } = await request(
      `${args.baseUrl}/responses`,
      {
        method: 'POST',
        headers: headers(args.apiKey),
        body: JSON.stringify({ model: args.model, input: 'Reply with exactly: OK', max_output_tokens: 8 }),
      },
      args.timeoutMs,
    )
    const text = await response.text()
    Object.assign(check, {
      ok: response.ok && text.length > 0,
      status: response.status,
      elapsedMs,
      receivedBytes: Buffer.byteLength(text),
    })
    if (!check.ok) check.error = `responses request failed (HTTP ${response.status})`
  } catch (error) {
    check.error = safeMessage(error, args.apiKey)
  }
  report.checks.push(check)
}

export async function runDoctor(args) {
  args.baseUrl = normalizeBaseUrl(args.baseUrl)
  if (!args.apiKey) throw new Error('API key is required; set LLMHUB_API_KEY or use --api-key')
  if ((args.chat || args.responses) && !args.model) {
    throw new Error('--model or LLMHUB_MODEL is required for a model request')
  }

  const report = {
    ok: false,
    baseUrl: args.baseUrl,
    model: args.model || null,
    paidRequestWarning: args.chat || args.responses,
    checkedAt: new Date().toISOString(),
    checks: [],
  }
  await checkModels(args, report)
  if (args.chat) await checkChat(args, report)
  if (args.responses) await checkResponses(args, report)
  report.ok = report.checks.every((check) => check.ok)
  return report
}

function printHuman(report) {
  console.log(`LLM API Doctor: ${report.ok ? 'PASS' : 'FAIL'}`)
  console.log(`Base URL: ${report.baseUrl}`)
  if (report.model) console.log(`Model: ${report.model}`)
  if (report.paidRequestWarning) console.log('Note: a model request was sent and may be billed.')
  for (const check of report.checks) {
    const details = [check.status && `HTTP ${check.status}`, check.elapsedMs !== undefined && `${check.elapsedMs} ms`]
      .filter(Boolean)
      .join(', ')
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${details ? ` (${details})` : ''}`)
    if (check.error) console.log(`  ${check.error}`)
  }
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
    if (args.help) {
      process.stdout.write(usage())
      return
    }
    const report = await runDoctor(args)
    if (args.json) console.log(JSON.stringify(report, null, 2))
    else printHuman(report)
    if (!report.ok) process.exitCode = 1
  } catch (error) {
    console.error(`Error: ${safeMessage(error, args?.apiKey || '')}`)
    console.error('Run with --help for usage.')
    process.exitCode = 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
