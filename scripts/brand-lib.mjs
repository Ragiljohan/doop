import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '..')

export function loadBrand() {
  return JSON.parse(readFileSync(path.join(ROOT, 'brand/brand.config.json'), 'utf8'))
}

/** Product-name substitutions inside one string body (quotes already removed). */
export function rewriteBody(body, mode) {
  if (body === 'doop') return { body, changed: false }
  const name = mode === 'token' ? '%%APP%%' : '@@NAME@@'
  const url = mode === 'token' ? '%%APP_URL%%' : '@@URL@@'
  const host = mode === 'token' ? '%%APP_HOST%%' : '@@HOST@@'
  let changed = false
  let next = body.replace(/https?:\/\/(?:www\.)?doop\.design/gi, () => {
    changed = true
    return url
  })
  next = next.replace(/doop\.design/gi, () => {
    changed = true
    return host
  })
  next = next.replace(/\bDoop\b/g, (match, offset, str) => {
    const prev = str.slice(Math.max(0, offset - 2), offset)
    if (prev === 'X-' || prev === 'x-') return match
    changed = true
    return name
  })
  /* A colon keeps storage keys and the frame postMessage protocol (`doop:html`). */
  next = next.replace(/(?<![\w/.-])doop(?![\w/.:-])/g, () => {
    changed = true
    return name
  })
  return { body: next, changed }
}

export function slotsToCode(body) {
  if (body === '@@NAME@@') return 'brand.name'
  if (body === '@@URL@@') return 'brand.publicUrl'
  if (body === '@@HOST@@') return 'brand.publicHost'
  let out = ''
  const re = /@@(?:NAME|URL|HOST)@@/g
  let last = 0
  for (const match of body.matchAll(re)) {
    out += escapeChunk(body.slice(last, match.index))
    if (match[0] === '@@NAME@@') out += '${brand.name}'
    else if (match[0] === '@@URL@@') out += '${brand.publicUrl}'
    else out += '${brand.publicHost}'
    last = match.index + match[0].length
  }
  out += escapeChunk(body.slice(last))
  return '`' + out + '`'
}

function escapeChunk(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

export function emitQuoted(cooked) {
  const escaped = cooked.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')
  return `'${escaped}'`
}

export function paintSvg(svg, brand) {
  return svg.replaceAll('__PRIMARY__', brand.primaryColor).replaceAll('__ACCENT__', brand.accentColor)
}

const SKIP_DIR = new Set(['node_modules', 'dist', 'data', 'storybook-static'])

export function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

/** Source that ships to a browser, an API client, or an email. */
export function servedFiles() {
  const roots = ['src', 'server', 'shared', 'public', 'workers'].map((dir) => path.join(ROOT, dir))
  const files = roots
    .filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory())
    .flatMap((dir) => walk(dir))
  files.push(path.join(ROOT, 'index.html'), path.join(ROOT, 'vite.config.ts'))
  return files.filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile())
}

export function isI18n(file) {
  return file.includes(`${path.sep}src${path.sep}lib${path.sep}i18n${path.sep}`)
}

export function isBrandModule(file) {
  return file.endsWith(`${path.sep}shared${path.sep}brand.ts`)
}

export function specifierFor(fromFile) {
  let rel = path.relative(path.dirname(fromFile), path.join(ROOT, 'shared/brand.ts'))
  rel = rel.split(path.sep).join('/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  const inServer = fromFile.includes(`${path.sep}server${path.sep}`)
  if (!inServer) rel = rel.replace(/\.ts$/, '')
  return rel
}
