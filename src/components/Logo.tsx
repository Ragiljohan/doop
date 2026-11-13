import { cn } from '@/lib/utils'

/** Square product mark. The art lives in `brand/assets` and is copied to
 *  `public/` by `bun run apply-brand`, so a new logo is a file swap plus that
 *  script, not an edit here. */
export function Logo({ className = 'size-[30px]' }: { className?: string }) {
  return <img src="/logo.svg" alt="" className={className} />
}

const mask = {
  WebkitMaskImage: 'url(/mark.svg)',
  maskImage: 'url(/mark.svg)',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
} as const

/** The glyph on its own, tinted with `color` or the current text colour.
 *  `size` is the box in px, or `fill` when a parent sets the box. */
export function DoopMark({
  size = 13,
  color,
  className = 'mr-px inline-block align-[-2px]',
}: {
  size?: number | 'fill'
  color?: string
  /** Kept so existing call sites still type-check. The glyph no longer hops. */
  animated?: boolean
  className?: string
}) {
  const box = size === 'fill' ? { width: '100%', height: '100%' } : { width: size, height: size }
  return (
    <span
      className={cn('inline-block', className)}
      style={{ ...box, backgroundColor: color ?? 'currentColor', ...mask }}
      aria-hidden
    />
  )
}
