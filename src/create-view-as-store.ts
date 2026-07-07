import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Zustand store state:override role code。null = 未切,用 actual。
 *
 * 只儲存**原始使用者選擇**;安全防線(非有權 user 不可生效)由 useEffectiveRole
 * 那一層擋 — 這樣不用 store 依賴 auth,decoupled 乾淨。
 */
export interface ViewAsState {
  effectiveRoleOverride: string | null
  setEffectiveRole: (code: string | null) => void
  /** 清 override(等同「回到我的視角」)。Consumer 應在 logout 時 call。 */
  reset: () => void
}

export type ViewAsStore = UseBoundStore<StoreApi<ViewAsState>>

export interface CreateViewAsStoreOptions {
  /**
   * `persist` middleware 的 name key。多 consumer app 在同 origin(同 vercel
   * domain 不同 path)時要各自不同名,避免 localStorage / sessionStorage 撞到。
   * 建議格式 `<app>:view-as-role`,如 `org-mgmt:view-as-role`。
   */
  storageKey: string
  /**
   * `session` (default) = 關 tab 就清,適合安全敏感的 admin SPA。
   * `local` = 跨 tab / 跨 session 保留,方便 dev 反覆測。
   */
  storage?: 'session' | 'local'
}

export function createViewAsStore(options: CreateViewAsStoreOptions): ViewAsStore {
  const { storageKey, storage = 'session' } = options
  return create<ViewAsState>()(
    persist(
      (set) => ({
        effectiveRoleOverride: null,
        setEffectiveRole: (role) => set({ effectiveRoleOverride: role }),
        reset: () => set({ effectiveRoleOverride: null }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() =>
          storage === 'local' ? localStorage : sessionStorage,
        ),
      },
    ),
  )
}
