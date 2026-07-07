import { useMemo } from 'react'

import type { ViewAsStore } from './create-view-as-store'
import type { RoleData } from './types'

/**
 * 給下拉選單 UI 用的 headless controller。
 *
 * View-as 這功能的 UI 差異很大(base-ui / radix / headless-ui / 自幹),
 * kit 不強推任一 UI library,只提供**狀態邏輯**:
 *   - allRoles:consumer 提供的 dropdown 顯示清單 (kit 不 auto-merge,不 filter)
 *   - currentLabel:目前顯示的標籤 (effective role name or fallback)
 *   - pick(code):切到某 role;code === actualRole 相當於 reset
 *   - reset():回到本人
 *   - isViewAs
 *
 * Consumer 用自家 UI (Menu / Popover / Select 等) 把這些 wire 起來。
 */

export interface ViewAsRoleOption {
  code: string
  name: string
  /** true = code 落在 systemRoles config 內;false = 自訂 role */
  isSystem: boolean
}

export interface UseViewAsControllerResult {
  /** 有沒有資格切 view-as (通常只有 super_admin true) */
  canViewAs: boolean
  /** 當前 view-as 選的 role code (未切 = actualRole) */
  effectiveRole: string | null
  /** 顯示標籤 (view-as 中的 role 名稱) */
  currentLabel: string
  /** actual role code (用於 disable / highlight「自己」) */
  actualRole: string | null
  /** 是否切換中 */
  isViewAs: boolean
  /**
   * Dropdown 要顯示的 role 清單,已排序 (system 先、然後名字)。
   *
   * **完全由 consumer 決定內容** — kit 直接把 `useRolesData()` 的 return
   * 拿來用,不會 auto-merge systemRoles config。若 consumer 沒提供
   * useRolesData,fallback 為 systemRoles config。
   */
  allRoles: ViewAsRoleOption[]
  /** 切到某 role code;code === actualRole 等同 reset */
  pick: (code: string) => void
  /** 回到本人視角 (清 override) */
  reset: () => void
}

export interface CreateUseViewAsControllerOptions<TSystemRole extends string> {
  systemRoles: readonly TSystemRole[]
  canViewAs: (actualRole: TSystemRole | null) => boolean
  labelFor: (code: string) => string | undefined
  useActualRole: () => TSystemRole | null
  /**
   * Consumer 提供的「dropdown 要顯示什麼」hook。回什麼就顯什麼,kit **不**
   * filter / merge / 去重。若 consumer 的 backend 已回含 system role 的完整
   * 清單,直接 pass through 即可;若只回 custom role,也 OK。
   *
   * 沒提供 → kit fallback 用 systemRoles config 產出選項 (適合沒有 custom role
   * 概念的 app)。
   *
   * Return `undefined` = 資料還沒載入 (kit 顯示 fallback 的 systemRoles);
   * return `[]` = 明確表示「就是沒 role」。
   */
  useRolesData?: () => RoleData[] | undefined
  /**
   * (選配) 排序 comparator。預設:落在 systemRoles config 的 code 排前,
   * 依 systemRoles 順序;其他 role 依 name locale compare。
   */
  compareRoles?: (a: ViewAsRoleOption, b: ViewAsRoleOption) => number
}

export function createUseViewAsController<TSystemRole extends string>(
  useViewAsStore: ViewAsStore,
  options: CreateUseViewAsControllerOptions<TSystemRole>,
): () => UseViewAsControllerResult {
  const {
    systemRoles,
    canViewAs,
    labelFor,
    useActualRole,
    useRolesData,
    compareRoles,
  } = options

  const systemCodesSet = new Set<string>(systemRoles as readonly string[])
  const systemOrder = new Map(systemRoles.map((code, idx) => [code as string, idx]))
  const defaultCompare = (a: ViewAsRoleOption, b: ViewAsRoleOption): number => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    if (a.isSystem && b.isSystem) {
      return (systemOrder.get(a.code) ?? 999) - (systemOrder.get(b.code) ?? 999)
    }
    return a.name.localeCompare(b.name, 'zh-Hant')
  }

  // Fallback 用 (沒 useRolesData 時 kit 自己組 systemRoles 選項)
  const systemFallback: ViewAsRoleOption[] = systemRoles.map((code) => ({
    code: code as string,
    name: labelFor(code as string) ?? (code as string),
    isSystem: true,
  }))

  return function useViewAsController(): UseViewAsControllerResult {
    const actualRole = useActualRole()
    const override = useViewAsStore((s) => s.effectiveRoleOverride)
    const setEffectiveRole = useViewAsStore((s) => s.setEffectiveRole)
    const reset = useViewAsStore((s) => s.reset)
    const rolesData = useRolesData?.()

    const eligible = canViewAs(actualRole)
    const overrideEligible = eligible && override !== null && override !== actualRole
    const effectiveRole: string | null = overrideEligible ? override : actualRole

    const allRoles = useMemo<ViewAsRoleOption[]>(() => {
      const source: ViewAsRoleOption[] = rolesData
        ? rolesData.map((r) => ({
            code: r.code,
            name: r.name,
            // isSystem 由 code 是否落在 systemRoles config 決定 — consumer 傳
            // 什麼就顯什麼,kit 只補 badge 分類 hint
            isSystem: systemCodesSet.has(r.code),
          }))
        : systemFallback
      // Sort 但不 mutate 原 array (可能是 react-query cache)
      return [...source].sort(compareRoles ?? defaultCompare)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rolesData])

    const currentLabelSource = effectiveRole
      ? allRoles.find((r) => r.code === effectiveRole)?.name ??
        labelFor(effectiveRole) ??
        effectiveRole
      : ''

    const pick = (code: string) => {
      if (!eligible) return
      if (code === actualRole) {
        reset()
      } else {
        setEffectiveRole(code)
      }
    }

    return {
      canViewAs: eligible,
      actualRole,
      effectiveRole,
      currentLabel: currentLabelSource,
      isViewAs: overrideEligible,
      allRoles,
      pick,
      reset,
    }
  }
}
