// Minimal browser shim for `node:async_hooks` AsyncLocalStorage
// Provides a no-op implementation suitable for client bundles.

export class AsyncLocalStorage<T> {
  private store: T | undefined

  getStore(): T | undefined {
    return this.store
  }

  run<R, TArgs extends unknown[]>(store: T, callback: (...args: TArgs) => R, ...args: TArgs): R {
    this.store = store
    try {
      return callback(...args)
    } finally {
      // leave store as-is; subsequent calls may overwrite
    }
  }

  enterWith(store: T): void {
    this.store = store
  }

  disable(): void {
    this.store = undefined
  }
}

export default { AsyncLocalStorage }
