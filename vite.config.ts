import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const brand = JSON.parse(
  readFileSync(fileURLToPath(new URL('./brand/brand.config.json', import.meta.url)), 'utf8'),
) as {
  name: string
  description: string
  primaryColor: string
  publicUrl: string
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Fills index.html from brand/brand.config.json so the document title is not a
 *  second copy of the product name. */
function brandHtml() {
  const origin = brand.publicUrl.replace(/\/$/, '')
  const replacements: Record<string, string> = {
    '%BRAND_TITLE%': escapeHtml(brand.name),
    '%BRAND_DESCRIPTION%': escapeHtml(brand.description),
    '%BRAND_THEME%': escapeHtml(brand.primaryColor),
    '%BRAND_OG_IMAGE%': escapeHtml(origin ? `${origin}/og.png` : '/og.png'),
  }
  return {
    name: 'brand-html',
    transformIndexHtml(html: string) {
      return html.replace(/%BRAND_(?:TITLE|DESCRIPTION|THEME|OG_IMAGE)%/g, (token) => replacements[token] ?? token)
    },
  }
}

/* Dev ports. The defaults are the only ones anyone normally needs; the env
   overrides exist so a second worktree can run its own pair without fighting
   the first for :4300/:4400. PORT is the same variable the server reads, so
   the proxy always points at whichever backend this `npm run dev` started. */
const apiPort = Number(process.env.PORT || 4400)
const webPort = Number(process.env.VITE_PORT || 4300)
const api = `http://localhost:${apiPort}`

const clipboardTests = [
  'tests/canvasClipboardBrowser.test.ts',
  'tests/elementContextMenuBrowser.test.ts',
  'tests/pageCanvasBrowser.test.ts',
]

export default defineConfig({
  plugins: [react(), tailwindcss(), brandHtml()],
  test: {
    /* agent worktrees live under .claude/ inside the repo; their copies of the
       suite must not run as ours */
    exclude: ['**/node_modules/**', '**/.claude/**'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    projects: [
      { test: { name: 'parallel', exclude: clipboardTests } },
      // Browser contexts share the system clipboard, so these files must run one at a time.
      { test: { name: 'clipboard', include: clipboardTests, fileParallelism: false } },
    ],
    /* seven files drive a real Chromium; closing one under a full parallel
       run can outlast the 10s default */
    hookTimeout: 30_000,
  },
  /* Error tracking resolves minified stack frames through the .map next to
     each bundle. The source is public (AGPL), so the maps are too; browsers
     only fetch them when devtools open. */
  build: { sourcemap: true },
  /* mupdf finds its .wasm next to its own module through `import.meta.url`;
     pre-bundling would move the module and lose the file */
  optimizeDeps: { exclude: ['mupdf'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: webPort,
    /* cargo's build output is huge and, on Windows, its binaries stay locked
       while the shell runs (EBUSY); nothing under it is ever served by vite */
    watch: {
      ignored: ['**/desktop/src-tauri/target/**'],
    },
    /* the doop-sync snippet posts to /ingest from foreign origins; vite
       answers CORS preflights itself before the proxy, so its default
       same-origin policy would block what the express server (prod) allows */
    cors: true,
    proxy: {
      /* changeOrigin stays OFF so the backend sees the web origin's Host and
         better-auth builds OAuth discovery/authorize URLs on that origin —
         the one that serves the login page and that MCP clients connect to */
      '/api': { target: api },
      '/mcp': { target: api },
      '/local-agent': { target: api },
      /* frame images only — a bare '/i' prefix would swallow /integrations */
      '/i/': { target: api },
      '/a/': { target: api },
      '/u/': { target: api },
      '/ingest': { target: api },
      '/relay': { target: api },
      '/blog': { target: api },
      '/robots.txt': { target: api },
      '/sitemap.xml': { target: api },
      '/.well-known': { target: api },
      '/ws': { target: `ws://localhost:${apiPort}`, ws: true },
    },
  },
})
