# rlnk-react-view-as

React admin SPA 的**角色視角切換(view-as / act-as)** 系統。Zustand store + hook + headless controller;UI 交給你自家 stack。

Generic 對你專案的 `TSystemRole` union,只要注入 role 定義就能用。

## 安裝

Package 發佈在 **npmjs.com 公開 registry**(MIT license)。零認證、零 `.npmrc` 設定:

```bash
bun add rlnk-react-view-as
# 或
npm install rlnk-react-view-as
```

Peer deps 需 `react >= 18` + `zustand >= 4`。

## 使用

**一次建立,export 給整個 app 用**:

```ts
// src/lib/view-as.ts
import { createViewAsSystem } from 'rlnk-react-view-as'
import { useAuthStore } from '@/stores/auth'
import { useRolesQuery } from '@/api/queries/roles'
import { ROLE_LABEL, ROLE_PERMISSIONS } from '@/lib/roles'

export const { useViewAsStore, useEffectiveRole, useViewAsController } =
  createViewAsSystem({
    // Zustand storage key,多 app 同 origin 要不同名
    storageKey: 'org-mgmt:view-as-role',
    // 'session' (default) 關 tab 清;'local' 跨 session 保留
    storage: 'session',

    // 系統 role union — 用 `as const` 讓 TS 推 TSystemRole
    systemRoles: ['super_admin', 'org_admin', 'hr_admin', 'member'] as const,

    // 誰有資格切 view-as
    canViewAs: (actual) => actual === 'super_admin',

    // 系統 role → effective permissions;view-as 切到 system 或未切都用這表
    rolePermissions: ROLE_PERMISSIONS,

    // role code → 顯示名。傳 undefined 表未定義,hook 會退回原字面
    labelFor: (code) => ROLE_LABEL[code as keyof typeof ROLE_LABEL],

    // Consumer 提供的 hook,回目前登入 user 的 actual role
    useActualRole: () => useAuthStore((s) => s.currentUser?.role ?? null),

    // (選配) 提供 dropdown 要顯示的完整 role list (kit 不 filter,不 merge)。
    // Backend 若回全部 (含 system + custom) 直接 pass through 即可,kit 用
    // systemRoles config 判 isSystem 給 badge / sort。沒提供 → kit 用
    // systemRoles config 產 fallback 選項 (適合沒 custom role 概念的 app)
    useRolesData: () => useRolesQuery().data,

    // (選配) permission literal 轉換 — 如剝掉 client prefix
    normalizePermission: (p) =>
      p === 'web-ad.*' ? '*' : p.startsWith('web-ad.') ? p.slice(7) : p,
  })
```

之後在 component 內:

```tsx
// 檢查權限
function UserListPage() {
  const { hasPermission } = useEffectiveRole()
  if (!hasPermission('user.list')) return <Forbidden />
  return <UserTable />
}

// 顯示當前 view-as
function Header() {
  const { effectiveRoleName, isViewAs } = useEffectiveRole()
  return <div>{isViewAs && <span>正在以 {effectiveRoleName} 視角</span>}</div>
}

// 自建下拉選單 UI (kit 只提供 headless controller,UI 你自己接)
function ViewAsSelector() {
  const { canViewAs, currentLabel, allRoles, actualRole, pick, reset, isViewAs } =
    useViewAsController()
  if (!canViewAs) return null
  return (
    <Menu>
      <MenuTrigger>{currentLabel}</MenuTrigger>
      <MenuList>
        {allRoles.map((r) => (
          <MenuItem key={r.code} onClick={() => pick(r.code)}>
            {r.name}
            {r.code === actualRole && ' (我自己)'}
            {!r.isSystem && ' [custom]'}
          </MenuItem>
        ))}
      </MenuList>
      {isViewAs && <button onClick={reset}>回到我的視角</button>}
    </Menu>
  )
}
```

## API

### `createViewAsSystem<TSystemRole>(config)`

一次配好,回 `{ useViewAsStore, useEffectiveRole, useViewAsController }`。

### `useEffectiveRole()` 回

| Field | Type | 說明 |
|---|---|---|
| `actualRole` | `TSystemRole \| null` | 真實 role,永不被 view-as 改變 |
| `effectiveRole` | `string \| null` | UI render 用 role code(含 custom) |
| `effectiveRoleName` | `string \| null` | 顯示名 |
| `isViewAs` | `boolean` | 是否在 view-as 模式 |
| `canViewAs` | `boolean` | 當前 user 是否有資格切 |
| `hasPermission(code)` | `(code: string) => boolean` | 檢查 effective role 有無此 permission,wildcard-aware |
| `isRole(code)` | `(code: string) => boolean` | effective role 是否等於此 code |

### `useViewAsController()` 回(給 dropdown UI 用)

| Field | Type | 說明 |
|---|---|---|
| `canViewAs` | `boolean` | 沒資格 → UI 應 `return null` |
| `actualRole` / `effectiveRole` | `string \| null` | 用於標記「我自己」/ 顯示當前選項 |
| `currentLabel` | `string` | 目前顯示的 role 名稱 |
| `isViewAs` | `boolean` | 是否正在切(顯示 reset 按鈕用) |
| `allRoles` | `ViewAsRoleOption[]` | 已排序:system 先,custom 後 |
| `pick(code)` | `(code: string) => void` | 切到某 role,`code === actualRole` 等同 reset |
| `reset()` | `() => void` | 回本人 |

### `useViewAsStore` 直接存取(rarely needed)

logout 時 call `useViewAsStore.getState().reset()` 清 override。

### `permissionSetMatches(permissions, code)`

Wildcard-aware:`*` 或 `<prefix>.*` 或精準字面。獨立 export 給 consumer 內部 permission check 用。

## Design decisions

- **Headless UI**:kit 不強推 UI library(base-ui / radix / headless-ui / 自幹皆可)。給 controller hook,你組 dropdown。
- **`useRolesData` 為 hook 而非 data**:讓 consumer 用自家 react-query / SWR / 手撈都行,不綁 fetch 方式。
- **`useActualRole` 為 hook 而非 store**:同上,不強推 zustand。實際 kit 內部確實用 zustand 存 override state,但**這是 kit 家的事**,consumer 不用感受到。
- **`storage: 'session'` 預設**:對齊 admin SPA 安全預設(關 tab 就清)。dev 想快速反覆測改 `local`。

## Release

Tag `v0.1.0` push 到 GitHub → workflow 自動 build + publish 到 GitHub Package Registry。

```bash
# bump version
npm version patch  # or minor / major
git push --follow-tags
```

## License

MIT — see [LICENSE](LICENSE)。
