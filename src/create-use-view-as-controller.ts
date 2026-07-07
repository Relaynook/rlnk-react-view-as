import { useMemo } from 'react'

import type { ViewAsStore } from './create-view-as-store'
import type { CustomRoleData } from './types'

/**
 * 給下拉選單 UI 用的 headless controller。
 *
 * View-as 這功能的 UI 差異很大(base-ui / radix / headless-ui / 自幹),
 * kit 不強推任一 UI library,只提供**狀態邏輯**:
 *   - allRoles: system + custom 合併並排序
 *   - currentLabel: 目前顯示的標籤(effective role name or fallback)
 *   - pick(code): 切到某 role;code === actualRole 相當於 reset
 *   - reset(): 回到本人
 *   - isViewAs / isDisabled
 *
 * Consumer 用自家 UI (Menu / Popover / Select 等) 把這些 wire 起來。
 */

export interface ViewAsRoleOption {
  code: string
  name: string
  /** true = system role;false = custom(consumer 自建) */
  isSystem: boolean
}

export interface UseViewAsControllerResult {
  /** 有沒有資格切 view-as(通常只有 super_admin true) */
  canViewAs: boolean
  /** 當前 view-as 選的 role code(未切 = actualRole) */
  effectiveRole: string | null
  /** 顯示標籤(view-as 中的 role 名稱) */
  currentLabel: string
  /** actual role code(用於 disable / highlight「自己」) */
  actualRole: string | null
  /** 是否切換中 */
  isViewAs: boolean
  /** 排序好的可選 role 清單:system 在前,custom 在後 */
  allRoles: ViewAsRoleOption[]
  /** 切到某 role code;code === actualRole 等同 reset */
  pick: (code: string) => void
  /** 回到本人視角(清 override) */
  reset: () => void
}

export interface CreateUseViewAsControllerOptions<TSystemRole extends string> {
  systemRoles: readonly TSystemRole[]
  canViewAs: (actualRole: TSystemRole | null) => boolean
  labelFor: (code: string) => string | undefined
  useActualRole: () => TSystemRole | null
  useCustomRolesData?: () => CustomRoleData[] | undefined
  /**
   * (選配)排序 comparator。預設:system role 依 systemRoles 順序、
   * custom role 依 name locale compare。
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
    useCustomRolesData,
    compareRoles,
  } = options

  const systemOrder = new Map(systemRoles.map((code, idx) => [code as string, idx]))
  const defaultCompare = (a: ViewAsRoleOption, b: ViewAsRoleOption): number => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    if (a.isSystem && b.isSystem) {
      return (systemOrder.get(a.code) ?? 999) - (systemOrder.get(b.code) ?? 999)
    }
    return a.name.localeCompare(b.name, 'zh-Hant')
  }

  return function useViewAsController(): UseViewAsControllerResult {
    const actualRole = useActualRole()
    const override = useViewAsStore((s) => s.effectiveRoleOverride)
    const setEffectiveRole = useViewAsStore((s) => s.setEffectiveRole)
    const reset = useViewAsStore((s) => s.reset)
    const customRoles = useCustomRolesData?.() ?? []

    const eligible = canViewAs(actualRole)
    const overrideEligible = eligible && override !== null && override !== actualRole
    const effectiveRole: string | null = overrideEligible ? override : actualRole

    const allRoles = useMemo<ViewAsRoleOption[]>(() => {
      const systemOpts: ViewAsRoleOption[] = systemRoles.map((code) => ({
        code: code as string,
        name: labelFor(code as string) ?? (code as string),
        isSystem: true,
      }))
      const customOpts: ViewAsRoleOption[] = customRoles.map((r) => ({
        code: r.code,
        name: r.name,
        isSystem: false,
      }))
      const merged = [...systemOpts, ...customOpts]
      merged.sort(compareRoles ?? defaultCompare)
      return merged
      // customRoles 內容變才重排;systemRoles 是 config 給的 constant
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customRoles])

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
