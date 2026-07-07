import { useMemo } from 'react'

import type { ViewAsStore } from './create-view-as-store'
import { permissionSetMatches } from './permission-set-matches'
import type { RoleData, UseEffectiveRoleResult } from './types'

/**
 * Consumer 傳的 config,建 useEffectiveRole 用。
 *
 * 泛型 `TSystemRole`:consumer 專案自家的 system role union,如
 * `'super_admin' | 'org_admin' | 'hr_admin' | 'member'`。
 */
export interface CreateUseEffectiveRoleOptions<TSystemRole extends string> {
  /**
   * 全部 system role code (runtime 用來驗值);寫成 `as const` 陣列讓 TS 推
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
   * Role code → 顯示名。System / custom 都會過這個 lookup;system 通常從自家
   * ROLE_LABEL 表拿。回 undefined = 沒定義,hook 退回原字面。
   */
  labelFor: (code: string) => string | undefined
  /**
   * Consumer 提供的 hook,回目前登入 user 的 actual role。
   * 通常包 authStore:`() => useAuthStore((s) => s.currentUser?.role ?? null)`。
   */
  useActualRole: () => TSystemRole | null
  /**
   * (選配) Consumer 提供的 hook,回**所有** role list (system + custom;kit
   * 不 filter)。view-as 切到某 role 時,kit 從此 list 拿 permissions + name。
   *
   * 常見接法:`() => useRolesQuery().data`
   *
   * Return `undefined` = 資料還沒載入 (kit 會 fallback 到 rolePermissions);
   * `[]` = 明確無 custom role。
   */
  useRolesData?: () => RoleData[] | undefined
  /**
   * (選配) permission literal 前置轉換 — 給共用 SPA (admin 前綴) 的情境。
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
    useRolesData,
    normalizePermission,
  } = options

  const systemRoleSet: ReadonlySet<string> = new Set(systemRoles)
  const isSystemRoleCode = (v: unknown): v is TSystemRole =>
    typeof v === 'string' && systemRoleSet.has(v)

  const normalize = normalizePermission ?? ((p: string) => p)

  return function useEffectiveRole(): UseEffectiveRoleResult<TSystemRole> {
    const actualRole = useActualRole()
    const override = useViewAsStore((s) => s.effectiveRoleOverride)
    const rolesData = useRolesData?.()

    return useMemo(() => {
      const eligible = canViewAs(actualRole)

      // 決定 override 是否**有效**:
      //   - 若 rolesData 已載入 → 必須落在 systemRoles 或 rolesData 內才算 valid
      //   - 若 rolesData 未載入 (undefined) → 只要 systemRole 就算 valid
      //     (custom role 因為驗不了先容忍;等 rolesData 載入後如果不在裡面自動失效)
      // 無效 override → 完全 fallback 到 actual (effectiveRole = actual,
      // permissions 也是 actual 的)。這修 AC-008:sessionStorage 值被人為改
      // 成無效 code 不該讓 UI 進 view-as 狀態。
      const overrideKnown =
        override !== null &&
        (isSystemRoleCode(override) ||
          (rolesData?.some((r) => r.code === override) ?? true))

      const overrideEligible =
        eligible && override !== null && override !== actualRole && overrideKnown
      const effectiveRole: string | null = overrideEligible ? override : actualRole

      // 決 effective permissions:
      //   1. 沒切 / 切到自己 / override 無效 → 用 rolePermissions[actualRole]
      //   2. 切到 system role → rolePermissions[override]
      //   3. 切到 custom role → 從 rolesData 拿該 role 的 permissions
      let effectivePermissions: ReadonlySet<string>
      if (overrideEligible && rolesData) {
        const role = rolesData.find((r) => r.code === override)
        if (role) {
          effectivePermissions = new Set(role.permissions.map(normalize))
        } else if (isSystemRoleCode(override)) {
          effectivePermissions = rolePermissions[override]
        } else {
          // 理論上 overrideKnown 已擋掉;此分支 defensive
          effectivePermissions = EMPTY_SET
        }
      } else if (isSystemRoleCode(effectiveRole)) {
        effectivePermissions = rolePermissions[effectiveRole]
      } else {
        effectivePermissions = EMPTY_SET
      }

      // 顯示名:rolesData 優先,再 fallback labelFor,再退回原字面
      let effectiveRoleName: string | null = null
      if (effectiveRole) {
        const fromData = rolesData?.find((r) => r.code === effectiveRole)?.name
        effectiveRoleName = fromData ?? labelFor(effectiveRole) ?? effectiveRole
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
    }, [actualRole, override, rolesData])
  }
}
