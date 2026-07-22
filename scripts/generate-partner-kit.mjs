#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function usage() {
  return `Usage: node scripts/generate-partner-kit.mjs [options]

Options:
  --partner <slug>     Stable partner slug (required)
  --aff-code <code>    Public affiliate code (required)
  --channel <name>     UTM medium, e.g. integration or tutorial
  --landing <url>      Signup URL (default: https://llmhub.vip/sign-up)
  --redeem <code>      Optional public redemption code
  --output <dir>       Output directory (default: partner-kits)
  --help               Show this help
`
}

export function parsePartnerArgs(argv) {
  const args = {
    partner: '',
    affCode: '',
    channel: 'integration',
    landing: 'https://llmhub.vip/sign-up',
    redeem: '',
    output: 'partner-kits',
    help: false,
  }
  const mapping = {
    '--partner': 'partner',
    '--aff-code': 'affCode',
    '--channel': 'channel',
    '--landing': 'landing',
    '--redeem': 'redeem',
    '--output': 'output',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') args.help = true
    else if (mapping[arg]) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`)
      args[mapping[arg]] = value
      index += 1
    } else throw new Error(`unknown option: ${arg}`)
  }
  return args
}

export function buildPartnerKit(args) {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(args.partner)) {
    throw new Error('partner must be a lowercase slug with 2-40 characters')
  }
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(args.affCode)) throw new Error('invalid affiliate code')
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(args.channel)) throw new Error('invalid channel')
  const signupUrl = new URL(args.landing)
  if (signupUrl.protocol !== 'https:') throw new Error('landing URL must use https')
  signupUrl.searchParams.set('aff', args.affCode)
  signupUrl.searchParams.set('utm_source', 'partner')
  signupUrl.searchParams.set('utm_medium', args.channel)
  signupUrl.searchParams.set('utm_campaign', args.partner)

  const data = {
    partner: args.partner,
    channel: args.channel,
    signupUrl: signupUrl.toString(),
    redemptionCode: args.redeem || null,
    baseUrl: 'https://llmhub.vip/v1',
    doctorCommand: 'node ./bin/llm-api-doctor.mjs --chat',
  }
  const redeemLine = data.redemptionCode
    ? `\nКод тестового баланса: \`${data.redemptionCode}\` (номинал и срок уточняйте перед публикацией).`
    : ''
  const markdown = `# LLMHub × ${args.partner}\n\n` +
    `Подключение: ${data.signupUrl}\n\n` +
    'Base URL: `https://llmhub.vip/v1`\n\n' +
    'После регистрации создайте API key, выберите доступную модель и запустите диагностику из репозитория.\n' +
    redeemLine + '\n\n' +
    'Партнёр не должен запрашивать API key, пароль или содержимое запросов пользователя.\n'
  return { data, markdown }
}

async function main() {
  try {
    const args = parsePartnerArgs(process.argv.slice(2))
    if (args.help) {
      process.stdout.write(usage())
      return
    }
    if (!args.partner || !args.affCode) throw new Error('--partner and --aff-code are required')
    const kit = buildPartnerKit(args)
    const outputDir = path.resolve(args.output)
    await mkdir(outputDir, { recursive: true })
    await Promise.all([
      writeFile(path.join(outputDir, `${args.partner}.json`), `${JSON.stringify(kit.data, null, 2)}\n`, 'utf8'),
      writeFile(path.join(outputDir, `${args.partner}.md`), kit.markdown, 'utf8'),
    ])
    console.log(`Created partner kit: ${args.partner}`)
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
