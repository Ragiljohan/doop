import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import sharp from 'sharp'
import {
  ROOT,
  emitQuoted,
  isBrandModule,
  isI18n,
  loadBrand,
  paintSvg,
  rewriteBody,
  servedFiles,
  slotsToCode,
  specifierFor,
} from './brand-lib.mjs'

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs'])

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (file.endsWith('.js') || file.endsWith('.mjs')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function skipLiteral(node) {
  const parent = node.parent
  if (!parent) return false
  if (ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) return true
  if (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) return true
  if (ts.isExternalModuleReference(parent)) return true
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true
  if (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === 'require' &&
    parent.arguments[0] === node
  )
    return true
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node) return true
  if (ts.isEnumMember(parent) && parent.name === node) return true
  if (ts.isLiteralTypeNode(parent)) return true
  return false
}

function codeForCooked(cooked) {
  const { body, changed } = rewriteBody(cooked, 'slot')
  if (!changed) return null
  return slotsToCode(body)
}

function tokenForCooked(cooked) {
  const { body, changed } = rewriteBody(cooked, 'token')
  if (!changed) return null
  return emitQuoted(body)
}

function push(replacements, node, next, needsBrand) {
  if (!next || next === node.getText()) return
  replacements.push({ start: node.getStart(), end: node.getEnd(), next })
  if (next.includes('brand.')) needsBrand.add(true)
}

function rewriteSource(file, text) {
  const kind = scriptKind(file)
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const i18n = isI18n(file)
  const replacements = []
  const needsBrand = new Set()

  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !skipLiteral(node)) {
      const next = i18n ? tokenForCooked(node.text) : codeForCooked(node.text)
      const wrapped = next && ts.isJsxAttribute(node.parent) ? `{${next}}` : next
      push(replacements, node, wrapped, needsBrand)
    } else if (!i18n && ts.isTemplateExpression(node)) {
      const quasis = [node.head, ...node.templateSpans.map((span) => span.literal)]
      for (const quasi of quasis) {
        const raw = quasi.getText()
        const { body, changed } = rewriteBody(raw, 'slot')
        if (!changed) continue
        const next = body
          .replaceAll('@@NAME@@', '${brand.name}')
          .replaceAll('@@URL@@', '${brand.publicUrl}')
          .replaceAll('@@HOST@@', '${brand.publicHost}')
        push(replacements, quasi, next, needsBrand)
      }
    } else if (ts.isJsxText(node)) {
      const next = i18n ? null : codeForCooked(node.getText())
      push(replacements, node, next ? `{${next}}` : null, needsBrand)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  if (replacements.length === 0) return { text, changed: false }
  replacements.sort((a, b) => b.start - a.start)
  let out = text
  for (const replacement of replacements) {
    out = out.slice(0, replacement.start) + replacement.next + out.slice(replacement.end)
  }
  if (needsBrand.size > 0) out = ensureImport(file, out)
  return { text: out, changed: out !== text }
}

function ensureImport(file, text) {
  const spec = specifierFor(file)
  if (text.includes(`from '${spec}'`) || text.includes(`from "${spec}"`)) return text
  if (/from\s+['"][^'"]*shared\/brand(?:\.ts)?['"]/.test(text)) return text
  const line = `import { brand } from '${spec}'\n`
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file))
  let end = 0
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) {
      if (end > 0) break
      continue
    }
    end = stmt.getEnd()
  }
  if (end === 0) return line + text
  const at = text[end] === '\n' ? end + 1 : end
  return text.slice(0, at) + line + text.slice(at)
}

function writeIfChanged(file, contents) {
  const next = typeof contents === 'string' ? contents : contents
  let prev = null
  try {
    prev = readFileSync(file)
  } catch {
    prev = null
  }
  const buf = Buffer.isBuffer(next) ? next : Buffer.from(next)
  if (prev && prev.equals(buf)) return false
  writeFileSync(file, buf)
  return true
}

async function raster(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer()
}

function ogSvg(logoSvg) {
  const inner = logoSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f4f4f5"/>
  <g transform="translate(460 175) scale(8.75)">${inner}</g>
</svg>
`
}

async function writeAssets(brand) {
  const logo = paintSvg(readFileSync(path.join(ROOT, 'brand/assets/logo.svg'), 'utf8'), brand)
  const mark = readFileSync(path.join(ROOT, 'brand/assets/mark.svg'))
  const changed = []
  const pub = (name) => path.join(ROOT, 'public', name)
  if (writeIfChanged(pub('logo.svg'), logo)) changed.push('public/logo.svg')
  if (writeIfChanged(pub('mark.svg'), mark)) changed.push('public/mark.svg')
  const sizes = [
    ['logo.png', 512],
    ['favicon.png', 96],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]
  const pngs = new Map()
  for (const [name, size] of sizes) {
    const png = await raster(logo, size)
    pngs.set(size, png)
    if (writeIfChanged(pub(name), png)) changed.push(`public/${name}`)
  }
  const ico = await raster(logo, 32)
  const icoFile = icoFromPng(ico, 32)
  if (writeIfChanged(pub('favicon.ico'), icoFile)) changed.push('public/favicon.ico')
  const og = await sharp(Buffer.from(ogSvg(logo)))
    .png()
    .toBuffer()
  if (writeIfChanged(pub('og.png'), og)) changed.push('public/og.png')
  const manifest = `${JSON.stringify(
    {
      name: brand.name,
      short_name: brand.shortName,
      description: brand.description,
      start_url: '/',
      display: 'standalone',
      background_color: '#f4f4f5',
      theme_color: brand.primaryColor,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  )}\n`
  if (writeIfChanged(pub('manifest.webmanifest'), manifest)) changed.push('public/manifest.webmanifest')
  return changed
}

function icoFromPng(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = size >= 256 ? 0 : size
  entry[1] = size >= 256 ? 0 : size
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

function notice(brand) {
  return `NOTICE

This program is a modified version of Doop, the open-source design canvas.
Doop is copyright its contributors and is licensed under the GNU Affero
General Public License, version 3. The same license applies to this
modified version. The full text is in the LICENSE file. Copyright and
license notices in the source are kept.

Upstream project: ${brand.links.upstream}
Source for this modified version: ${brand.links.source}
${
  brand.showSourceLink === false
    ? ''
    : `
Network users can reach that source from the Source link in the app.
`
}`
}

const brand = loadBrand()
const assetChanges = await writeAssets(brand)
const noticeChanged = writeIfChanged(path.join(ROOT, 'NOTICE'), notice(brand))
const textChanges = []
for (const file of servedFiles()) {
  if (!TEXT_EXT.has(path.extname(file))) continue
  if (isBrandModule(file)) continue
  const text = readFileSync(file, 'utf8')
  const result = rewriteSource(file, text)
  if (!result.changed) continue
  writeFileSync(file, result.text)
  textChanges.push(path.relative(ROOT, file))
}
if (textChanges.length > 0) {
  execFileSync('bunx', ['prettier', '--write', ...textChanges], { cwd: ROOT, stdio: 'inherit' })
}
const touched = [...assetChanges, ...(noticeChanged ? ['NOTICE'] : []), ...textChanges]
if (touched.length === 0) console.log('apply-brand: already applied')
else console.log(`apply-brand: updated ${touched.length} file(s)`)
