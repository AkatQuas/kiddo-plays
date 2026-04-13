/**
 * Application route path mapping for windows
 */
export const AppRoutes = {
  /** main window */
  main: {
    HOME: '/',
    LOGIN: '/login',
    SETTINGS: '/settings',
    TEST: '/test',
  },
} as const

type ExtractNestedValues<T extends Record<string, Record<string, string>>> = {
  [ParentKey in keyof T]: T[ParentKey][keyof T[ParentKey]]
}[keyof T]

// ============== 使用 ==============
export type AppRouteName = ExtractNestedValues<typeof AppRoutes>
