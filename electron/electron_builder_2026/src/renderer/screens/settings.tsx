import { RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SettingsStore } from 'shared/types/store'
import type { UpdateInfo } from 'shared/types/update'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { useAppStore } from '../stores/app'

const { App } = window

const LANGUAGE_OPTIONS = [
  { value: 'en', getLabel: (t: (key: string) => string) => t('languageEn') },
  { value: 'zh', getLabel: (t: (key: string) => string) => t('languageZh') },
] as const

const THEME_OPTIONS = [
  { value: 'light', getLabel: (t: (key: string) => string) => t('themeLight') },
  { value: 'dark', getLabel: (t: (key: string) => string) => t('themeDark') },
] as const

/**
 * Validate proxy URL - must be valid http:// or https:// URL
 */
function isValidProxyUrl(url: string): boolean {
  if (!url.trim()) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const SettingsScreen = () => {
  const { t } = useTranslation('settings')
  const [saving, setSaving] = useState(false)

  const {
    theme,
    language,
    autoCheckUpdate,
    proxy,
    setTheme,
    setLanguage,
    setAutoCheckUpdate,
    setProxy,
  } = useAppStore()

  // Validate proxy URL when enabled
  const proxyUrlValid = useMemo(
    () => !proxy.enabled || isValidProxyUrl(proxy.url),
    [proxy.enabled, proxy.url]
  )

  const handleSave = async () => {
    // Validate proxy URL if enabled
    if (proxy.enabled && !isValidProxyUrl(proxy.url)) {
      toast.error(t('proxyUrlInvalid') || 'Invalid proxy URL')
      return
    }

    setSaving(true)
    try {
      await App.invoke('settings.set', {
        theme,
        language,
        autoCheckUpdate,
        proxy,
      })
      toast.success(t('saveSuccess') || 'Settings saved')
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleManualCheck = async () => {
    await App.invoke('updater.check')
    toast.info(t('checking'))
  }

  // Update event listeners
  useEffect(() => {
    const unsubAvailable = window.App.on(
      'update-available',
      (info: UpdateInfo) => {
        toast.info(t('updateAvailable', { version: info.version }), {
          duration: Infinity,
          action: {
            label: t('download'),
            onClick: () => App.invoke('updater.download'),
          },
          cancel: t('later'),
        })
      }
    )

    const unsubDownloaded = window.App.on(
      'update-downloaded',
      (info: UpdateInfo) => {
        toast.info(t('updateReady', { version: info.version }), {
          duration: Infinity,
          action: {
            label: t('installNow'),
            onClick: () => App.invoke('updater.install'),
          },
          cancel: t('installOnNextLaunch'),
        })
      }
    )

    const unsubNotAvailable = window.App.on('update-not-available', () => {
      toast.info(t('noUpdate'))
    })

    return () => {
      unsubAvailable()
      unsubDownloaded()
      unsubNotAvailable()
    }
  }, [t])

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <SettingsIcon className="size-6 text-primary" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>

      {/* Settings Form */}
      <div className="flex-1 p-6">
        <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border p-4">
          {/* Language */}
          <div className="space-y-2">
            <Label htmlFor="language">{t('language')}</Label>
            <Select
              onValueChange={value =>
                setLanguage(value as SettingsStore['language'])
              }
              value={language}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder={t('languagePlaceholder')}>
                  {LANGUAGE_OPTIONS.find(
                    opt => opt.value === language
                  )?.getLabel(t)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.getLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme">{t('theme')}</Label>
            <Select
              onValueChange={value => setTheme(value as SettingsStore['theme'])}
              value={theme}
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder={t('themePlaceholder')}>
                  {THEME_OPTIONS.find(opt => opt.value === theme)?.getLabel(t)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.getLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Updates */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoCheckUpdate">{t('autoCheckUpdate')}</Label>
              <Switch
                checked={autoCheckUpdate}
                id="autoCheckUpdate"
                onCheckedChange={setAutoCheckUpdate}
              />
            </div>
            <Button onClick={handleManualCheck} size="sm" variant="secondary">
              <RefreshCw className="mr-1 size-3" />
              {t('checkForUpdates')}
            </Button>
          </div>

          {/* Proxy */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="proxyEnabled">{t('proxy')}</Label>
              <Switch
                checked={proxy.enabled}
                id="proxyEnabled"
                onCheckedChange={enabled => setProxy({ ...proxy, enabled })}
              />
            </div>
            {proxy.enabled && (
              <div className="space-y-1">
                <Input
                  className={
                    !proxyUrlValid
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }
                  id="proxyUrl"
                  onChange={e => setProxy({ ...proxy, url: e.target.value })}
                  placeholder={t('proxyPlaceholder')}
                  value={proxy.url}
                />
                {!proxyUrlValid && (
                  <p className="text-xs text-destructive">
                    {t('proxyUrlInvalid') ||
                      'Please enter a valid http:// or https:// URL'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
