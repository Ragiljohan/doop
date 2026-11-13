import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { ROOT, isBrandModule, servedFiles } from './brand-lib.mjs'

/**
 * Fails when a served surface still shows the upstream product name.
 * Scans string literals, template text, JSX text, HTML and CSS.
 * Comments and code identifiers are not the product name on screen.
 *
 * Allowed on purpose (wire protocol and storage keys, not a brand):
 *   data-doop-*, doop-instructions, doop-sync, doop-theme, doop-locale,
 *   doop-rail, doop-fonts, doop:, X-Doop-*, the role id "doop", DOOP_* env names.
 * LICENSE, CHANGELOG, copyright lines and NOTICE are not served surfaces.
 * desktop/, ios/, chrome-extension/, claude-extension/, chatgpt-plugin/
 * and cursor-plugin/ are not rebranded.
 */

const PROTOCOL = [
  /data-doop-[\w-]*/,
  /x-doop-[\w-]*/i,
  /doop-instructions/,
  /doop-sync/,
  /doop-theme/,
  /doop-locale/,
  /doop-rail/,
  /doop-fonts/,
  /doop-mask/,
  /doop-use/,
  /doop-on\b/,
  /doop-action/,
  /doop-locked/,
  /doop-id\b/,
  /doop-drawing/,
  /doop-canvas-element/,
  /doop:/,
  /DOOP_[A-Z0-9_]+/,
]

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (file.endsWith('.js') || file.endsWith('.mjs')) return ts.ScriptKind.JS
  if (file.endsWith('.html')) return null
  return ts.ScriptKind.TS
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

function violationsIn(text, base) {
  const found = []
  const patterns = [/doop\.design/gi, /\bDoop\b/g, /(?<![\w/.-])doop(?![\w/.-])/g]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0
      const around = text.slice(Math.max(0, index - 40), index + match[0].length + 40)
      if (PROTOCOL.some((rule) => rule.test(around))) continue
      if (match[0] === 'Doop' || match[0] === 'doop') {
        const prev = text.slice(Math.max(0, index - 2), index)
        if (prev === 'X-' || prev === 'x-') continue
      }
      /* The role id and the desktop URL scheme stay as the literal token. */
      if (match[0] === 'doop' && text === 'doop') continue
      const before = text[index - 1]
      const after = text[index + match[0].length]
      if (match[0] === 'doop' && before && before === after && (before === "'" || before === '"' || before === '`'))
        continue
      found.push({ index: base + index, sample: around.replace(/\s+/g, ' ').trim() })
    }
  }
  return found
}

function collectJs(file, text) {
  const kind = scriptKind(file)
  if (!kind) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const chunks = []
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      chunks.push({ index: node.getStart(), text: node.text })
    } else if (ts.isTemplateExpression(node)) {
      const quasis = [node.head, ...node.templateSpans.map((span) => span.literal)]
      for (const quasi of quasis) chunks.push({ index: quasi.getStart(), text: quasi.text })
    } else if (ts.isJsxText(node)) {
      chunks.push({ index: node.getStart(), text: node.getText() })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return chunks.flatMap((chunk) => violationsIn(chunk.text, chunk.index))
}

function stripComments(text, html) {
  if (html) return text.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (comment) => comment.replace(/[^\n]/g, ' '))
}

const failures = []
for (const file of servedFiles()) {
  if (isBrandModule(file)) continue
  const ext = path.extname(file)
  if (!['.ts', '.tsx', '.js', '.mjs', '.html', '.css'].includes(ext)) continue
  const text = readFileSync(file, 'utf8')
  const rel = path.relative(ROOT, file)
  let hits = []
  if (ext === '.html' || ext === '.css') {
    const stripped = stripComments(text, ext === '.html')
    hits = violationsIn(stripped, 0)
  } else {
    hits = collectJs(file, text)
  }
  for (const hit of hits) {
    failures.push(`${rel}:${lineOf(text, hit.index)}: ${hit.sample}`)
  }
}

if (failures.length > 0) {
  console.error(`brand:check found ${failures.length} upstream brand hit(s):\n`)
  console.error(failures.slice(0, 200).join('\n'))
  if (failures.length > 200) console.error(`\n… and ${failures.length - 200} more`)
  process.exit(1)
}
console.log('brand:check: no upstream brand on served surfaces')
