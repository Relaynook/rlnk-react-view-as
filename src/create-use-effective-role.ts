import { useMemo } from 'react'

import type { ViewAsStore } from './create-view-as-store'
import { permissionSetMatches } from './permission-set-matches'
import type { CustomRoleData, UseEffectiveRoleResult } from './types'

/**
 * Consumer 傳的 config,建 useEffectiveRole 用。
 *
 * 泛型 `TSystemRole`:consumer 專案自家的 system role union,如
 * `'super_admin' | 'org_admin' | 'hr_admin' | 'member'`。
 */
export interface CreateUseEffectiveRoleOptions<TSystemRole extends string> {
  /**
   * 全部 system role code(runtime 用來驗值);寫成 `as const` 陣列讓 TS 推
   * TSystemRole。
   */
  systemRoles: readonly TSystemRole[]
  /**
   * 判斷此 actualRole 有沒有資格切 view-as。通常只有 super_admin true。
   */
  canViewAs: (actualRole: TSystemRole | null) => boolean
  /**
   * 系統 role → effective permissions 的 map。View-as 切到 system role
   * 時直接查此表。
   */
  rolePermissions: Record<TSystemRole, ReadonlySet<string>>
  /**
   * Role code → 顯示名(system + custom 都會過)。System role 通常從自家
   * 寫死的 ROLE_LABEL 拿;custom 交給 useCustomRolesData 提供。
   *
   * 回 undefined 表沒找到,useEffectiveRole 會退回原始 code 字面。
   */
  labelFor: (code: string) => string | undefined
  /**
   * Consumer 提供的 hook,回目前登入 user 的 actual role。
   * 通常包 authStore:`() => useAuthStore((s) => s.currentUser?.role ?? null)`。
   */
  useActualRole: () => TSystemRole | null
  /**
   * (選配)consumer 提供的 hook,回 admin 自建 custom roles 的完整 list。
   * 沒提供時,view-as 只能切 system role。給 view-as 切到 custom role 時
   * 從 data 拿 permissions + name。
   *
   * 常見接法:`() => useRolesQuery().data ?? []`
   */
  useCustomRolesData?: () => CustomRoleData[] | undefined
  /**
   * (選配)permission literal 前置轉換 — 給共用 SPA(admin 前綴)的情境。
   *
   * 例:backend `role.permissions` 存的是 `web-ad.user.list` 這種 full key,
   * 但 nav-config / RequirePermission 檢查用「短碼」`user.list`。
   * 傳 `(p) => p.startsWith('web-ad.') ? p.slice(7) : p` 就會在算 permissions
   * 時剝掉 client prefix。
   *
   * 不傳 = 不做任何轉換,原字面存進 set。
   */
  normalizePermission?: (permission: string) => string
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/**
 * 工廠 — 傳 config 進去,拿一個綁定該 config 的 useEffectiveRole hook 回來。
 * Consumer 應該在 app 內 call 一次、export 產出的 hook 給整個 app 用。
 */
export function createUseEffectiveRole<TSystemRole extends string>(
  useViewAsStore: ViewAsStore,
  options: CreateUseEffectiveRoleOptions<TSystemRole>,
): () => UseEffectiveRoleResult<TSystemRole> {
  const {
    systemRoles,
    canViewAs,
    rolePermissions,
    labelFor,
    useActualRole,
    useCustomRolesData,
    normalizePermission,
  } = options

  const systemRoleSet: ReadonlySet<string> = new Set(systemRoles)
  const isSystemRoleCode = (v: unknown): v is TSystemRole =>
    typeof v === 'string' && systemRoleSet.has(v)

  const normalize = normalizePermission ?? ((p: string) => p)

  return function useEffectiveRole(): UseEffectiveRoleResult<TSystemRole> {
    const actualRole = useActualRole()
    const override = useViewAsStore((s) => s.effectiveRoleOverride)
    const customRoles = useCustomRolesData?.()

    return useMemo(() => {
      const eligible = canViewAs(actualRole)
      // 安全防線:非有資格 user 的 override 一律忽略
      const overrideEligible =
        eligible && override !== null && override !== actualRole
      const effectiveRole: string | null = overrideEligible ? override : actualRole

      // 決 effective permissions:
      //   1. 沒切 view-as / 切到自己 → 用 rolePermissions[actualRole]
      //   2. 切到 system role → 同上 (用 rolePermissions[override])
      //   3. 切到 custom role → 從 useCustomRolesData 拿那個 role 的 permissions
      let effectivePermissions: ReadonlySet<string>
      if (overrideEligible && customRoles) {
        const role = customRoles.find((r) => r.code === override)
        if (role) {
          effectivePermissions = new Set(role.permissions.map(normalize))
        } else if (isSystemRoleCode(override)) {
          effectivePermissions = rolePermissions[override]
        } else {
          // Override code 不存在(可能已被刪)
          effectivePermissions = EMPTY_SET
        }
      } else if (isSystemRoleCode(effectiveRole)) {
        effectivePermissions = rolePermissions[effectiveRole]
      } else {
        effectivePermissions = EMPTY_SET
      }

      // 顯示名:custom 從 data,system 從 labelFor;沒查到退回原字面
      let effectiveRoleName: string | null = null
      if (effectiveRole) {
        const fromCustom = customRoles?.find((r) => r.code === effectiveRole)?.name
        effectiveRoleName = fromCustom ?? labelFor(effectiveRole) ?? effectiveRole
      }

      return {
        actualRole,
        effectiveRole,
        effectiveRoleName,
        isViewAs: effectiveRole !== null && effectiveRole !== actualRole,
        canViewAs: eligible,
        hasPermission: (code) => permissionSetMatches(effectivePermissions, code),
        isRole: (code) => effectiveRole === code,
      }
    }, [actualRole, override, customRoles])
  }
}
