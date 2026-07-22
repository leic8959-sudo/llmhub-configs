import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue
      files.push(...await listFiles(path.join(directory, entry.name), relative))
    } else if (!(prefix === 'partner-kits' && entry.name !== 'README.md')) {
      files.push(relative)
    }
  }
  return files
}

const files = await listFiles(root)
const textFiles = files.filter((file) => /\.(?:md|json|toml|mjs|example|gitignore)$/.test(file) || path.basename(file) === 'LICENSE')
const forbidden = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /Bearer\s+(?!YOUR_API_KEY)[A-Za-z0-9._-]{16,}/,
  /LLMHUB_API_KEY\s*=\s*(?!<api-key>|"<api-key>")[^\s#]+/,
]
const errors = []

for (const file of textFiles) {
  const content = await readFile(path.join(root, file), 'utf8')
  if (content.includes('\r')) errors.push(`${file}: CRLF line endings are not allowed`)
  for (const pattern of forbidden) {
    if (pattern.test(content)) errors.push(`${file}: possible secret detected`)
  }
  if (file.endsWith('.json')) {
    try {
      JSON.parse(content)
    } catch (error) {
      errors.push(`${file}: invalid JSON (${error.message})`)
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Checked ${textFiles.length} text files: OK`)
}
