import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'
import { useLocale } from '../lib/i18n'

/* Cloudflare Turnstile's explicit-render API, the part this page uses. */
interface TurnstileApi {
  render(
    el: HTMLElement,
    options: {
      sitekey: string
      theme: 'light' | 'dark'
      language: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ): string | undefined
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<TurnstileApi> | null = null

/** Loads Cloudflare's script once per page; a failed load may be retried. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => {
      script.remove()
      loading = null
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * The Turnstile challenge on the email sign-in form. It reports a token, or
 * null when the token expires or the challenge fails; a token is good for one
 * call, so the form remounts this (a new `key`) after every attempt.
 */
export function Turnstile({
  siteKey,
  onToken,
  onLoadError,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  onLoadError: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const { resolved } = useTheme()
  const { locale } = useLocale()
  /* the callbacks change every render; the widget keeps the first ones */
  const report = useRef({ onToken, onLoadError })
  useEffect(() => {
    report.current = { onToken, onLoadError }
  })

  useEffect(() => {
    let widgetId: string | undefined
    let live = true
    loadTurnstile()
      .then((api) => {
        if (!live || !host.current) return
        widgetId = api.render(host.current, {
          sitekey: siteKey,
          theme: resolved,
          language: locale.toLowerCase(),
          callback: (token) => report.current.onToken(token),
          'expired-callback': () => report.current.onToken(null),
          'error-callback': () => report.current.onToken(null),
        })
      })
      .catch(() => {
        if (live) report.current.onLoadError()
      })
    return () => {
      live = false
      report.current.onToken(null)
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, resolved, locale])

  return <div ref={host} className="flex min-h-[65px] justify-center" />
}
