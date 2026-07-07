/**
 * Consumer 提供的一筆自訂 role(從 backend 抓來)。系統內建 role 由
 * `systemRoles` config 帶,不走這裡。
 */
export interface CustomRoleData {
  code: string
  name: string
  /**
   * 該 role 掛的 permissions(可能含 wildcard 字面,如 `*` / `prefix.*` /
   * `prefix.code`)。View-as 切到此 role 時,effective permissions 用這份。
   */
  permissions: string[]
}

export interface UseEffectiveRoleResult<TSystemRole extends string> {
  /** 登入時真實 role(系統 role);永不被 view-as 改變 */
  actualRole: TSystemRole | null
  /**
   * UI render 用的 role code。可能 = actual,也可能是 view-as 切到的任意
   * role code(含 admin 自建的 custom role)。System role 是 TSystemRole
   * 字串;custom 則為 backend role.code 任意字串。
   */
  effectiveRole: string | null
  /** effective role 顯示名(custom 從 data;system 從 config.labelFor) */
  effectiveRoleName: string | null
  /** 當前是否在 view-as 模式(effective !== actual) */
  isViewAs: boolean
  /** 當前 user 是否**有資格**切 view-as(由 config.canViewAs 決定) */
  canViewAs: boolean
  /** 對 effective role 檢查 permission */
  hasPermission: (code: string) => boolean
  /** effective role 是否等於指定 code */
  isRole: (code: string) => boolean
}
