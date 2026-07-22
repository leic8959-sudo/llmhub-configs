import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildPartnerKit } from '../scripts/generate-partner-kit.mjs'
import { parseArgs, runDoctor } from '../bin/llm-api-doctor.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

async function runCli(relativeScript, args) {
  const child = spawn(process.execPath, [relativeScript, ...args], {
    cwd: root,
    env: { ...process.env, LLMHUB_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const [code] = await once(child, 'close')
  return { code, stdout, stderr }
}

async function withServer(handler, callback) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const { port } = server.address()
    await callback(`http://127.0.0.1:${port}/v1`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

test('doctor checks models and chat without exposing the key', async () => {
  const seen = []
  await withServer(async (request, response) => {
    seen.push({ url: request.url, authorization: request.headers.authorization })
    response.setHeader('content-type', 'application/json')
    if (request.url === '/v1/models') {
      response.end(JSON.stringify({ data: [{ id: 'gpt-test' }] }))
    } else {
      response.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }], usage: { total_tokens: 2 } }))
    }
  }, async (baseUrl) => {
    const report = await runDoctor({
      baseUrl,
      apiKey: 'test-key',
      model: 'gpt-test',
      chat: true,
      stream: false,
      responses: false,
      timeoutMs: 2_000,
      json: true,
    })
    assert.equal(report.ok, true)
    assert.equal(report.checks[0].requestedModelAvailable, true)
    assert.equal(report.checks[1].usagePresent, true)
    assert.equal(JSON.stringify(report).includes('test-key'), false)
  })
  assert.deepEqual(seen.map((item) => item.url), ['/v1/models', '/v1/chat/completions'])
  assert.ok(seen.every((item) => item.authorization === 'Bearer test-key'))
})

test('doctor reads an SSE stream and records first-byte timing', async () => {
  await withServer((request, response) => {
    if (request.url === '/v1/models') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ data: [{ id: 'gpt-test' }] }))
      return
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    response.write('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n')
    response.end('data: [DONE]\n\n')
  }, async (baseUrl) => {
    const report = await runDoctor({
      baseUrl,
      apiKey: 'test-key',
      model: 'gpt-test',
      chat: true,
      stream: true,
      responses: false,
      timeoutMs: 2_000,
      json: true,
    })
    assert.equal(report.ok, true)
    assert.equal(report.checks[1].name, 'chat_stream')
    assert.equal(typeof report.checks[1].firstByteMs, 'number')
    assert.ok(report.checks[1].receivedBytes > 0)
  })
})

test('argument parser keeps paid checks opt-in', () => {
  const args = parseArgs([])
  assert.equal(args.chat, false)
  assert.equal(args.responses, false)
})

test('both command-line entry points print help', async () => {
  const doctor = await runCli('bin/llm-api-doctor.mjs', ['--help'])
  const partner = await runCli('scripts/generate-partner-kit.mjs', ['--help'])
  assert.equal(doctor.code, 0)
  assert.match(doctor.stdout, /Usage: llm-api-doctor/)
  assert.equal(partner.code, 0)
  assert.match(partner.stdout, /generate-partner-kit/)
})

test('partner kit creates an attributed HTTPS signup URL', () => {
  const kit = buildPartnerKit({
    partner: 'example-studio',
    affCode: 'ABCD',
    channel: 'integration',
    landing: 'https://llmhub.vip/sign-up',
    redeem: '',
  })
  const url = new URL(kit.data.signupUrl)
  assert.equal(url.searchParams.get('aff'), 'ABCD')
  assert.equal(url.searchParams.get('utm_campaign'), 'example-studio')
  assert.equal(kit.markdown.includes('API key, пароль'), true)
})
