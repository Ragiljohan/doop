import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

/**
 * Turnstile on, against the real server: the email sign-in, sign-up and
 * password-reset calls are refused without a token, before any account is
 * looked at, and the sign-in page is told the site key. Cloudflare's own
 * verification of a token needs its network and is not driven here.
 */

let server: Server

beforeAll(async () => {
  server = await startServer({ TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key' })
}, 70_000)

afterAll(() => server?.stop())

describe('Turnstile', () => {
  it('tells the sign-in page its site key, never the secret', async () => {
    const res = await new Client(server).get('/api/oidc-config')
    const body = await res.text()
    expect(JSON.parse(body)).toMatchObject({ turnstileSiteKey: 'site-key' })
    expect(body).not.toContain('secret-key')
  })

  it.each([
    ['/api/auth/sign-in/email', { email: 'someone@test.dev', password: 'password12345' }],
    ['/api/auth/sign-up/email', { email: 'someone@test.dev', password: 'password12345', name: 'Someone' }],
    ['/api/auth/request-password-reset', { email: 'someone@test.dev', redirectTo: '/auth/reset' }],
  ])('refuses %s without a token', async (path, body) => {
    const res = await new Client(server).post(path, body)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('MISSING_RESPONSE')
  })
})
