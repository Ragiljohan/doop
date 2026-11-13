import { brand } from '../../shared/brand'
import { cursorMcpInstallUrl } from '../lib/cursorConnection'
import { Button } from './ui/button'
import { CodeBlock } from './ui/code-block'
import { InstallBlock } from './ui/install-block'
import { useT } from '../lib/i18n'

export function CursorInstall({ mcpUrl }: { mcpUrl: string }) {
  const t = useT()
  return (
    <InstallBlock
      action={
        <Button asChild variant="solid">
          <a href={cursorMcpInstallUrl(mcpUrl)}>{t('workspace.cursorAdd')}</a>
        </Button>
      }
      manualLabel={t('workspace.connectionHelp')}
      manual={
        <>
          <p>
            {t('workspace.cursorHelpBefore')} <strong>Customize</strong> {t('workspace.cursorHelpMiddle')}{' '}
            <code>{brand.name}</code> {t('workspace.cursorHelpAfter')}
          </p>
          <CodeBlock
            text={JSON.stringify({ mcpServers: { [brand.name]: { url: mcpUrl } } }, null, 2)}
            className="mt-2.5"
          />
        </>
      }
    />
  )
}
