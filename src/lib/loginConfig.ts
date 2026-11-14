import { useEffect, useState } from 'react'
import type { LoginPolicy } from '../../shared/instanceSettings'

/** Matches GET /api/oidc-config: server/auth.ts loginProvidersConfig plus
 *  the instance's sign-in policy (shared/instanceSettings.ts loginPolicy). */
export interface LoginConfig extends LoginPolicy {
  enabled: boolean
  displayName?: string
  google: boolean
  microsoft: boolean
  /** the browser "Sign in with Apple" (the iOS app's native one is appleNative, not shown here) */
  apple: boolean
  /** Cloudflare Turnstile's site key, set when the email forms need a token */
  turnstileSiteKey?: string
}

/* Until the server answers, nothing optional is offered: sign-up stays
   hidden rather than flashing a form the instance may refuse. */
const UNCONFIGURED: LoginConfig = {
  enabled: false,
  google: false,
  microsoft: false,
  apple: false,
  emailPasswordSignup: false,
  ssoAutoRedirect: false,
}

let pending: Promise<LoginConfig> | null = null

/* The client bundle is static and shared across self-hosted deploys, so it
   asks the server which sign-in options exist. One request per page load,
   shared by the sign-in form and a guest's banner on a shared canvas. */
function fetchLoginConfig(): Promise<LoginConfig> {
  pending ??= fetch('/api/oidc-config')
    .then((res) => (res.ok ? (res.json() as Promise<Partial<LoginConfig>>) : {}))
    .then((body) => ({ ...UNCONFIGURED, ...body }))
    .catch(() => {
      pending = null // let the next mount ask again
      return UNCONFIGURED
    })
  return pending
}

export function useLoginConfig(): LoginConfig {
  const [config, setConfig] = useState<LoginConfig>(UNCONFIGURED)
  useEffect(() => {
    let live = true
    void fetchLoginConfig().then((next) => {
      if (live) setConfig(next)
    })
    return () => {
      live = false
    }
  }, [])
  return config
}
