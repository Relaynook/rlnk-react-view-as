import {
  createUseEffectiveRole,
  type CreateUseEffectiveRoleOptions,
} from './create-use-effective-role'
import {
  createUseViewAsController,
  type CreateUseViewAsControllerOptions,
} from './create-use-view-as-controller'
import {
  createViewAsStore,
  type CreateViewAsStoreOptions,
  type ViewAsStore,
} from './create-view-as-store'
import type { UseEffectiveRoleResult } from './types'
import type { UseViewAsControllerResult } from './create-use-view-as-controller'

/**
 * 一次 config,拿回整組 view-as hook。
 *
 * Consumer 通常在 app 的 lib/ 內建立一次,export 給整個 app 用:
 *
 * ```ts
 * // src/lib/view-as.ts
 * import { createViewAsSystem } from 'rlnk-react-view-as'
 * import { useAuthStore } from '@/stores/auth'
 * import { useRolesQuery } from '@/api/queries/roles'
 * import { ROLE_LABEL, ROLE_PERMISSIONS } from '@/lib/roles'
 *
 * export const { useViewAsStore, useEffectiveRole, useViewAsController } =
 *   createViewAsSystem({
 *     storageKey: 'org-mgmt:view-as-role',
 *     systemRoles: ['super_admin', 'org_admin', 'hr_admin', 'member'] as const,
 *     canViewAs: (actual) => actual === 'super_admin',
 *     rolePermissions: ROLE_PERMISSIONS,
 *     labelFor: (code) => ROLE_LABEL[code as keyof typeof ROLE_LABEL],
 *     useActualRole: () => useAuthStore((s) => s.currentUser?.role ?? null),
 *     useCustomRolesData: () => useRolesQuery().data,
 *   })
 * ```
 */
export interface CreateViewAsSystemOptions<TSystemRole extends string>
  extends CreateViewAsStoreOptions,
    Omit<CreateUseEffectiveRoleOptions<TSystemRole>, 'systemRoles' | 'canViewAs' | 'labelFor' | 'useActualRole' | 'useCustomRolesData'>,
    Pick<
      CreateUseEffectiveRoleOptions<TSystemRole>,
      | 'systemRoles'
      | 'canViewAs'
      | 'labelFor'
      | 'useActualRole'
      | 'useCustomRolesData'
      | 'rolePermissions'
      | 'normalizePermission'
    > {
  /**
   * (選配)view-as controller 的 role 排序 comparator。預設 system role 在前
   * 且照 systemRoles config 的順序;custom role 依 name locale compare。
   */
  compareRoles?: CreateUseViewAsControllerOptions<TSystemRole>['compareRoles']
}

export interface ViewAsSystem<TSystemRole extends string> {
  useViewAsStore: ViewAsStore
  useEffectiveRole: () => UseEffectiveRoleResult<TSystemRole>
  useViewAsController: () => UseViewAsControllerResult
}

export function createViewAsSystem<TSystemRole extends string>(
  options: CreateViewAsSystemOptions<TSystemRole>,
): ViewAsSystem<TSystemRole> {
  const {
    storageKey,
    storage,
    systemRoles,
    canViewAs,
    rolePermissions,
    labelFor,
    useActualRole,
    useCustomRolesData,
    normalizePermission,
    compareRoles,
  } = options

  const useViewAsStore = createViewAsStore({ storageKey, storage })

  const useEffectiveRole = createUseEffectiveRole<TSystemRole>(useViewAsStore, {
    systemRoles,
    canViewAs,
    rolePermissions,
    labelFor,
    useActualRole,
    useCustomRolesData,
    normalizePermission,
  })

  const useViewAsController = createUseViewAsController<TSystemRole>(useViewAsStore, {
    systemRoles,
    canViewAs,
    labelFor,
    useActualRole,
    useCustomRolesData,
    compareRoles,
  })

  return { useViewAsStore, useEffectiveRole, useViewAsController }
}
