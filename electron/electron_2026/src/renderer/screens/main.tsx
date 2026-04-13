import { Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Counter from '../components/counter'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'

export const HomeScreen = () => {
  const { t } = useTranslation()

  return (
    <main className="flex flex-col items-center justify-center h-screen bg-background">
      <Alert className="mt-5 bg-transparent border-transparent text-accent w-fit">
        <AlertTitle className="text-5xl text-teal-400">{t('hello')}</AlertTitle>

        <AlertDescription className="flex items-center gap-2 text-lg">
          <Terminal className="size-6 text-fuchsia-300" />

          <span className="text-gray-400">
            It's time to build something awesome!
          </span>
        </AlertDescription>
      </Alert>
      <Counter></Counter>
    </main>
  )
}
