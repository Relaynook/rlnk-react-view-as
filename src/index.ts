/**
 * @relaynook/react-view-as
 *
 * Role view-as (act-as) system for React admin SPAs。
 *
 * 主要入口:
 *   - `createViewAsSystem<TSystemRole>()`: 一次 config,吐一組 hook 給 app 用
 *
 * 若你想更細粒度控制 (自己組 store / hook / controller):
 *   - `createViewAsStore()`
 *   - `createUseEffectiveRole()`
 *   - `createUseViewAsController()`
 *
 * 也 export helper:
 *   - `permissionSetMatches(permissions, code)`: wildcard-aware permission check
 */

export {
  createViewAsSystem,
  type CreateViewAsSystemOptions,
  type ViewAsSystem,
} from './create-view-as-system'

export {
  createViewAsStore,
  type CreateViewAsStoreOptions,
  type ViewAsState,
  type ViewAsStore,
} from './create-view-as-store'

export {
  createUseEffectiveRole,
  type CreateUseEffectiveRoleOptions,
} from './create-use-effective-role'

export {
  createUseViewAsController,
  type CreateUseViewAsControllerOptions,
  type ViewAsRoleOption,
  type UseViewAsControllerResult,
} from './create-use-view-as-controller'

export { permissionSetMatches } from './permission-set-matches'

export type { CustomRoleData, UseEffectiveRoleResult } from './types'
