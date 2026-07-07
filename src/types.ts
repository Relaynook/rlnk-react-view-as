/**
 * Consumer 提供的一筆 role 資料 (通常從 backend 抓來)。給 view-as 切換到某
 * role 時查 permissions,以及 dropdown 顯示 name 用。
 *
 * 命名:v0.1.0-0.1.5 曾叫 `CustomRoleData`,實務上 backend 通常回全部 (含
 * system + custom),叫 custom 誤導 consumer 以為要 filter,故 v0.1.6 更名。
 * `CustomRoleData` alias 保留 (deprecated,見 index.ts export)。
 */
export interface RoleData {
  code: string
  name: string
  /**
   * 該 role 掛的 permissions (可能含 wildcard 字面,如 `*` / `prefix.*` /
   * `prefix.code`)。View-as 切到此 role 時 effective permissions 用這份。
   */
  permissions: string[]
}

/**
 * @deprecated 用 `RoleData` — v0.2 之前保留 alias。
 */
export type CustomRoleData = RoleData

export interface UseEffectiveRoleResult<TSystemRole extends string> {
  /** 登入時真實 role;永不被 view-as 改變 */
  actualRole: TSystemRole | null
  /**
   * UI render 用的 role code。可能 = actual,也可能是 view-as 切到的任意
   * role code (含 admin 自建的 custom role)。System role 是 TSystemRole
   * 字串;custom 則為 backend role.code 任意字串。
   */
  effectiveRole: string | null
  /** effective role 顯示名 (rolesData 優先,再 fallback labelFor) */
  effectiveRoleName: string | null
  /** 當前是否在 view-as 模式 (effective !== actual) */
  isViewAs: boolean
  /** 當前 user 是否**有資格**切 view-as (由 config.canViewAs 決定) */
  canViewAs: boolean
  /** 對 effective role 檢查 permission */
  hasPermission: (code: string) => boolean
  /** effective role 是否等於指定 code */
  isRole: (code: string) => boolean
}
