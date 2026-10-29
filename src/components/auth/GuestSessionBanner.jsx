import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { accountWallPath } from '../../utils/accountWall'
import { Icon } from '../common/Icon'

const DISMISS_KEY = 'goofly:guest-notice-dismissed'

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function GuestSessionBanner({ embedded = false }) {
  const t = useT()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sessão indisponível: fecha só nesta tela */
    }
    setDismissed(true)
  }

  return (
    <div className={embedded ? 'shrink-0 print:hidden' : 'mb-3 print:hidden'}>
      <div className={
        embedded
          ? 'flex max-w-[16rem] items-start gap-1 rounded-md border border-primary bg-primary/25 px-2 py-1 text-xs font-bold leading-snug text-primary sm:max-w-none'
          : 'flex max-w-xl items-start gap-2 rounded-lg border-2 border-primary bg-primary/25 px-2.5 py-1.5 text-xs font-semibold leading-snug text-primary shadow-sm'
      }>
        <p className="min-w-0 flex-1">
          {t(embedded ? 'guest.banner_short' : 'guest.banner')}{' '}
          <Link to={accountWallPath('/trips/new')} className="underline decoration-2 underline-offset-2 hover:text-foreground">
            {t('guest.login')}
          </Link>
          {' · '}
          <Link to="/register" className="underline decoration-2 underline-offset-2 hover:text-foreground">
            {t('guest.register')}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-0.5 text-primary/80 hover:bg-primary/15 hover:text-primary"
          aria-label={t('guest.dismiss')}
        >
          <Icon name="close" className="text-base" />
        </button>
      </div>
    </div>
  )
}
