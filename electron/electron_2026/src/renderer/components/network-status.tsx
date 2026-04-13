import { ServerOff, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EventArgs } from 'shared/types/ipc'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'

export function NetworkStatus() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<EventArgs<'network.status'>[0]>({
    isOnline: true,
    isServiceReachable: true,
  })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubscribe = window.App.on('network.status', payload => {
      setStatus(payload)
      setDismissed(false)
    })

    return unsubscribe
  }, [])

  const showAlert =
    !dismissed && (!status.isOnline || !status.isServiceReachable)

  if (!showAlert) {
    return null
  }

  // Determine the appropriate message based on status
  const isNetworkDown = !status.isOnline

  const title = isNetworkDown
    ? t('network.offlineTitle', 'No Internet Connection')
    : t('network.serviceUnreachableTitle', 'Service Unavailable')

  const description = isNetworkDown
    ? t(
        'network.offlineMessage',
        'You appear to be offline. Some features may not be available.'
      )
    : t(
        'network.serviceUnreachableMessage',
        'Unable to connect to the service. Please try again later.'
      )

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3">
      <Alert
        className="mx-auto max-w-md shadow-lg bg-destructive text-destructive-foreground"
        variant="destructive"
      >
        {isNetworkDown ? (
          <WifiOff className="size-4" />
        ) : (
          <ServerOff className="size-4" />
        )}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
        <Button
          className="absolute top-2 right-2 size-6 p-0 text-destructive-foreground hover:bg-destructive/80"
          onClick={() => setDismissed(true)}
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </Alert>
    </div>
  )
}
