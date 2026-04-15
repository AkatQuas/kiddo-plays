import { Home, LogOut, Settings, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppRoutes } from 'shared/constants/routes'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
}

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Home', path: AppRoutes.main.HOME },
]

export function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path
  const isLoginPage = location.pathname === AppRoutes.main.LOGIN

  const handleLogout = async () => {
    await window.App.invoke('auth.logout')
    navigate(AppRoutes.main.LOGIN, { replace: true })
  }

  if (isLoginPage) {
    return null
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-14 flex flex-col items-center py-4 border-r border-border bg-card/50 backdrop-blur-sm z-40">
      {/* Logo / Brand */}
      <div className="mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-bold">
            Logo
          </span>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 flex flex-col gap-2">
        {menuItems.map(item => (
          <Button
            className="size-10"
            key={item.path}
            onClick={() => navigate(item.path)}
            size="icon"
            title={item.label}
            variant={isActive(item.path) ? 'secondary' : 'ghost'}
          >
            <item.icon className="size-5" />
          </Button>
        ))}
      </nav>

      {/* User Menu Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            className="size-10"
            size="icon"
            title={t('sidebar.menu')}
            variant="ghost"
          >
            <User className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8}>
          <DropdownMenuItem onClick={() => navigate(AppRoutes.main.SETTINGS)}>
            <Settings className="size-4 mr-2" />
            {t('sidebar.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="size-4 mr-2" />
            {t('sidebar.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  )
}
