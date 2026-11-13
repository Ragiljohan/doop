import config from '../brand/brand.config.json'

export type BrandLinks = {
  source: string
  upstream: string
  docs: string
  download: string
  website: string
}

export type BrandConfig = {
  name: string
  shortName: string
  tagline: string
  description: string
  primaryColor: string
  accentColor: string
  supportEmail: string
  senderName: string
  emailFrom: string
  publicUrl: string
  footer: string
  links: BrandLinks
}

const file = config as BrandConfig

function slug(value: string): string {
  const out = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'design'
}

function hostOf(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

const mcpSlug = slug(file.shortName)

/** The white-label identity. Edit `brand/brand.config.json`, then `bun run apply-brand`. */
export const brand = {
  ...file,
  emailFrom: file.emailFrom || `${file.senderName} <no-reply@localhost>`,
  publicHost: hostOf(file.publicUrl),
  mcpSlug,
  mcpName: `${mcpSlug}-canvas`,
}

/** Token left in translation catalogs. `translateIn` swaps it for `brand.name`. */
export const BRAND_TOKEN = '%%APP%%'

/** Replace catalog tokens. Strings that never carried the product name pass through. */
export function applyBrand(text: string): string {
  if (!text.includes('%%APP')) return text
  return text
    .replaceAll('%%APP%%', brand.name)
    .replaceAll('%%APP_URL%%', brand.publicUrl)
    .replaceAll('%%APP_HOST%%', brand.publicHost)
}
