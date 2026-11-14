// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const shell = vi.hoisted(() => ({ desktop: false }))
vi.mock('../src/lib/auth', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'alice', name: 'Alice Doe' } } }), signOut: vi.fn() },
}))
vi.mock('../src/lib/me', () => ({ useMe: () => null }))
vi.mock('../src/lib/shell', () => ({ isDesktopShell: () => shell.desktop }))
import { AccountMenu } from '../src/components/DashShell'
import { brand } from '../shared/brand'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  shell.desktop = false
})

/* render the menu and open it from the keyboard, as Radix expects */
async function openMenu(): Promise<Map<string, string | null>> {
  await act(async () => root.render(<AccountMenu />))
  const trigger = container.querySelector('button')!
  await act(async () => {
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')].filter((a) => a.tagName === 'A')
  return new Map(links.map((a) => [a.textContent?.trim() ?? '', a.getAttribute('href')]))
}

/* Source follows brand config (showSourceLink); there is no docs site to link */
function expectSourceAndNoDocs(links: Map<string, string | null>) {
  if (brand.showSourceLink) expect(links.get('Source')).toBe(brand.links.source)
  else expect(links.has('Source')).toBe(false)
  expect(links.has('Help & docs')).toBe(false)
}

it('links the source only when brand config shows it, and hides empty marketing links', async () => {
  const links = await openMenu()
  expectSourceAndNoDocs(links)
  expect(links.has('Get desktop app')).toBe(false)
  expect(links.has('Design website')).toBe(false)
})

it('offers no download inside the desktop app', async () => {
  shell.desktop = true
  const links = await openMenu()
  expect(links.has('Get desktop app')).toBe(false)
  expectSourceAndNoDocs(links)
})
