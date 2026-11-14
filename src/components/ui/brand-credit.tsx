import { brand } from '../../../shared/brand'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** AGPL source offer and the brand's footer line, each when brand config
 *  sets it. The upstream credit itself lives in NOTICE, not on screen. */
export function BrandCredit({ className }: { className?: string }) {
  const t = useT()
  if (!brand.showSourceLink && !brand.footer) return null
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-soft', className)}>
      {brand.showSourceLink ? (
        <a className="underline underline-offset-2" href={brand.links.source} target="_blank" rel="noreferrer">
          {t('shell.source')}
        </a>
      ) : null}
      {brand.footer ? <span>{brand.footer}</span> : null}
    </p>
  )
}
