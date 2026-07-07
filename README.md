# rlnk-react-view-as

Role view-as (act-as) system for React admin SPAs. Zustand store + hook + headless dropdown controller; you bring your own UI stack.

Generic over your project's `TSystemRole` union — inject your role definitions and it works.

## Install

Published to **npmjs.com public registry** (MIT). No auth, no `.npmrc` setup:

```bash
bun add rlnk-react-view-as
# or
npm install rlnk-react-view-as
```

Peer deps: `react >= 18`, `zustand >= 4`.

## Integrate with AI agent (one-click copy)

Copy the prompt block below and paste it into Claude / ChatGPT / Cursor with your project specifics filled in — the agent will generate the wire-up code for you.

````markdown
I need to integrate the npm package **rlnk-react-view-as** (role view-as kit) into my React admin SPA. Please help me finish the integration.

## Package summary
- **What**: role view-as (act-as) system for React admin SPA
- **Provides**: Zustand store + `useEffectiveRole` hook + `useViewAsController` headless dropdown hook
- **UI**: no UI components — you build the dropdown with your own UI library
- **Peer deps**: `react >= 18`, `zustand >= 4`

## My project context (please confirm)
- **UI stack**: __[e.g. React + Vite / Next.js / ...]__
- **Dropdown library**: __[base-ui / radix-ui / headless-ui / hand-rolled / ...]__
- **Auth store**: __[Zustand / Redux / Context / other]__ — `currentUser.role` holds current role
- **System role union**: e.g. `'super_admin' | 'org_admin' | 'hr_admin' | 'member'`
- **Custom role source**: __[backend `/api/roles` returns all roles / no custom roles, only system]__
- **Permission code format**: __[short codes like `user.list` / or fully-qualified like `web-ad.user.list`]__ — if backend stores full keys but frontend nav uses short codes, `normalizePermission` should strip the prefix

## Tasks

1. **Create `src/lib/view-as.ts`** — one-shot `createViewAsSystem<TSystemRole>` config wire-up including:
   - `storageKey` (zustand persist key, e.g. `<app-name>:view-as-role`)
   - `storage: 'session'` (cleared when the tab closes; security default) or `'local'`
   - `systemRoles` (use `as const` so TS infers `TSystemRole`)
   - `canViewAs` (typically only `super_admin` returns true)
   - `rolePermissions` (system role → `Set<permission code>`)
   - `labelFor` (role code → display name)
   - `useActualRole` (read `currentUser.role` from your auth store)
   - `useRolesData` (fetch full role list from your backend via react-query / SWR; omit if there are no custom roles)
   - `normalizePermission` (optional — strip client prefix from permission strings)

2. **Consume in components**:
   - `useEffectiveRole()` — use `hasPermission(code)` for permission gates, `effectiveRoleName` for labels
   - `useViewAsController()` — build the dropdown selector with the UI library I specified above:
     - `canViewAs` (return `null` if false)
     - `allRoles` (already sorted: system first, then custom) — map to dropdown options
     - `currentLabel` (trigger text)
     - `pick(code)` / `reset()`
     - `isViewAs` (show banner + reset button when true)

3. **Remember**:
   - `useEffectiveRole` calls `useQuery` under the hood (via `useRolesData`), so `renderHook` tests need a `QueryClientProvider` wrapper
   - Call `useViewAsStore.getState().reset()` on logout to clear the override
   - `useRolesData`'s return list is what the dropdown shows verbatim — the kit does **not** filter or merge — if the backend returns all roles, the dropdown shows all roles

## Deliverables

- `src/lib/view-as.ts` (full config)
- A working `<ViewAsSelector />` component using the dropdown library I specified
- An in-component permission gate example: `const { hasPermission } = useEffectiveRole(); if (!hasPermission('user.list')) return <Forbidden />`

First confirm my **project context** above and fill in every `__[...]__` blank, then generate the code.
````

Before pasting the prompt, decide on your role code / permission naming conventions, dropdown library, and role-fetching mechanism — the agent needs these upfront.

## Usage

**Wire the kit once and export the hooks for the whole app**:

```ts
// src/lib/view-as.ts
import { createViewAsSystem } from 'rlnk-react-view-as'
import { useAuthStore } from '@/stores/auth'
import { useRolesQuery } from '@/api/queries/roles'
import { ROLE_LABEL, ROLE_PERMISSIONS } from '@/lib/roles'

export const { useViewAsStore, useEffectiveRole, useViewAsController } =
  createViewAsSystem({
    // zustand persist key. If multiple apps share the same origin,
    // give each a distinct key so their storage doesn't collide.
    // Convention: `<app-name>:view-as-role`, e.g. `org-mgmt:view-as-role`.
    storageKey: 'org-mgmt:view-as-role',
    // 'session' (default) clears on tab close; 'local' persists across sessions
    storage: 'session',

    // System role union — use `as const` so TS infers TSystemRole
    systemRoles: ['super_admin', 'org_admin', 'hr_admin', 'member'] as const,

    // Who is allowed to switch view-as
    canViewAs: (actual) => actual === 'super_admin',

    // System role → effective permissions. Used both when no override is set
    // and when the override picks a system role.
    rolePermissions: ROLE_PERMISSIONS,

    // Role code → display name. Return `undefined` if unknown — the hook falls
    // back to the raw code.
    labelFor: (code) => ROLE_LABEL[code as keyof typeof ROLE_LABEL],

    // Hook that returns the current logged-in user's real role
    useActualRole: () => useAuthStore((s) => s.currentUser?.role ?? null),

    // (Optional) Hook that returns the full role list to show in the dropdown
    // (system + custom). Pass the backend list through as-is — the kit will
    // NOT filter or merge; whatever you return is what the dropdown displays.
    // Use `systemRoles` in config to hint isSystem badges / sort ordering.
    useRolesData: () => useRolesQuery().data,

    // (Optional) Transform permission literals — useful for stripping a client
    // prefix so the frontend can check short codes.
    normalizePermission: (p) =>
      p === 'web-ad.*' ? '*' : p.startsWith('web-ad.') ? p.slice(7) : p,
  })
```

Then in components:

```tsx
// Gate a page on a permission
function UserListPage() {
  const { hasPermission } = useEffectiveRole()
  if (!hasPermission('user.list')) return <Forbidden />
  return <UserTable />
}

// Show the current view-as label
function Header() {
  const { effectiveRoleName, isViewAs } = useEffectiveRole()
  return <div>{isViewAs && <span>Viewing as {effectiveRoleName}</span>}</div>
}

// Build your own dropdown (kit only supplies the headless controller)
function ViewAsSelector() {
  const {
    canViewAs, currentLabel, allRoles, actualRole, pick, reset, isViewAs,
  } = useViewAsController()

  if (!canViewAs) return null

  return (
    <Menu>
      <MenuTrigger>{currentLabel}</MenuTrigger>
      <MenuList>
        {allRoles.map((r) => (
          <MenuItem key={r.code} onClick={() => pick(r.code)}>
            {r.name}
            {r.code === actualRole && ' (me)'}
            {!r.isSystem && ' [custom]'}
          </MenuItem>
        ))}
      </MenuList>
      {isViewAs && <button onClick={reset}>Back to my view</button>}
    </Menu>
  )
}
```

## API

### `createViewAsSystem<TSystemRole>(config)`

One call, returns `{ useViewAsStore, useEffectiveRole, useViewAsController }` — export them for use throughout the app.

### `useEffectiveRole()`

| Field | Type | Description |
|---|---|---|
| `actualRole` | `TSystemRole \| null` | The real role — never changed by view-as |
| `effectiveRole` | `string \| null` | Role code the UI should render as (may be a custom code) |
| `effectiveRoleName` | `string \| null` | Display name |
| `isViewAs` | `boolean` | True when in view-as mode |
| `canViewAs` | `boolean` | Whether the current user is allowed to switch |
| `hasPermission(code)` | `(code: string) => boolean` | Wildcard-aware permission check against the effective role |
| `isRole(code)` | `(code: string) => boolean` | Whether the effective role equals the given code |

### `useViewAsController()` — for building the dropdown UI

| Field | Type | Description |
|---|---|---|
| `canViewAs` | `boolean` | If false, `return null` |
| `actualRole` / `effectiveRole` | `string \| null` | Used to mark "me" / highlight current |
| `currentLabel` | `string` | Text for the dropdown trigger |
| `isViewAs` | `boolean` | Whether to show the reset button |
| `allRoles` | `ViewAsRoleOption[]` | Sorted: system first, custom next |
| `pick(code)` | `(code: string) => void` | Switch to a role; `code === actualRole` behaves like reset |
| `reset()` | `() => void` | Back to the real user's view |

### `useViewAsStore` (direct access, rarely needed)

Call `useViewAsStore.getState().reset()` on logout to clear the persisted override.

### `permissionSetMatches(permissions, code)`

Wildcard-aware check: matches `*`, `<prefix>.*`, or the exact literal. Exported separately for consumers doing their own permission checks.

## Design decisions

- **Headless UI**: The kit doesn't ship UI components — you use base-ui / radix / headless-ui / hand-rolled elements. It gives you a controller hook and you wire the dropdown.
- **`useRolesData` is a hook, not data**: Lets consumers use react-query / SWR / anything, without coupling the kit to a fetching strategy.
- **`useActualRole` is a hook, not a store**: Same reason — you're free to store auth in Zustand, Redux, or elsewhere. The kit internally uses Zustand for the override state, but that's an implementation detail.
- **`storage: 'session'` by default**: Safer default (override clears when the tab closes) — matches typical admin-SPA policy. Switch to `'local'` if you want overrides to persist for dev iteration.
- **The kit doesn't filter or merge roles**: What you pass to `useRolesData` is exactly what appears in the dropdown. This avoids the leaky abstraction where the consumer would have to know which roles the kit auto-populates.

## Release

Tag `v0.x.y` and push — the `.github/workflows/publish.yml` workflow will run `npm publish` to the public registry.

```bash
npm version patch  # or minor / major
git push --follow-tags
```

Local one-off publishes work too: `npm publish` from the repo root (requires npm login + 2FA).

## License

MIT — see [LICENSE](LICENSE).
