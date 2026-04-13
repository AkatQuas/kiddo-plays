import Store from 'electron-store'

const STORE_INSTANCES = new Map<string, Store>()

/**
 * Generic、LazyLoading、Singleton Electron Store Factory
 * @param name store namespace
 * @param defaults default values
 * @returns singleton Store instance
 */
export function createLazySingletonStore<
  T extends Record<string, any> = Record<string, unknown>,
>(name: string, defaults?: T, encrypt = false): Store<T> {
  if (STORE_INSTANCES.has(name)) {
    return STORE_INSTANCES.get(name) as Store<T>
  }

  const store = new Store<T>({
    name,
    defaults,
    encryptionKey: encrypt ? 'aes-256-gcm' : undefined,
  })

  STORE_INSTANCES.set(name, store as any)

  return store
}
