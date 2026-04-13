import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppRoutes } from 'shared/constants/routes'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const { App } = window

export const LoginScreen = () => {
  const { t } = useTranslation('login')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await App.invoke('auth.login', { email, password })

      if (res.ok) {
        toast.success(t('success'))
        navigate(AppRoutes.main.HOME)
      } else {
        toast.error(res.error || t('failed'))
      }
    } catch {
      toast.error(t('error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('welcome')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              disabled={isLoading}
              id="email"
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              type="email"
              value={email}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              disabled={isLoading}
              id="password"
              onChange={e => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
              type="password"
              value={password}
            />
          </div>

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? t('signingIn') : t('signIn')}
          </Button>
        </form>
      </div>
    </main>
  )
}
