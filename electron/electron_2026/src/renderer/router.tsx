import { Router } from 'lib/electron-router-dom'
import { Navigate, Route } from 'react-router-dom'
import { Layout } from './layout'
import { LoginScreen } from './screens/login'
import { HomeScreen } from './screens/main'
import { PanelScreen } from './screens/panel'
import { SettingsScreen } from './screens/settings'
import { TestScreen } from './screens/test'

export const AppRouter = () => {
  return (
    <Router
      main={
        <Route element={<Layout />} path="/">
          <Route element={<HomeScreen />} path="/" />
          <Route element={<SettingsScreen />} path="/settings" />
          <Route element={<LoginScreen />} path="/login" />
          {import.meta.env.DEV && (
            <Route element={<TestScreen />} path="/test" />
          )}
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      }
      panel={<Route element={<PanelScreen />} path="/"></Route>}
    />
  )
}
