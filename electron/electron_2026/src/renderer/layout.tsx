import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppRoutes } from 'shared/constants/routes'
import { Sidebar } from './components/sidebar'

export function Layout() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await window.App.invoke('auth.get-status')
        if (res.ok) {
          const target = res.data.isLoggedIn
            ? AppRoutes.main.HOME
            : AppRoutes.main.LOGIN
          navigate(target, { replace: true })
        } else {
          navigate(AppRoutes.main.LOGIN, { replace: true })
        }
      } catch {
        navigate(AppRoutes.main.LOGIN, { replace: true })
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [navigate])

  // Listen for navigation events from main process (menu clicks)
  useEffect(() => {
    return window.App.on('navigate', (route, options) => {
      navigate(route, options)
    })
  }, [navigate])

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-screen bg-background">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-14 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
