/**
 * 對「任意 permission 集合(含 wildcard)」做匹配。
 *
 * Permissions 字串可能是:
 *   - `*`             全 ecosystem wildcard(通常給 super admin)
 *   - `<prefix>.*`    某 client 全 wildcard
 *   - `<prefix>.<code>` 精準 permission
 *
 * @example
 * ```
 * permissionSetMatches(new Set(['*']), 'user.list') === true
 * permissionSetMatches(new Set(['user.*']), 'user.list') === true
 * permissionSetMatches(new Set(['user.list']), 'user.list') === true
 * permissionSetMatches(new Set(['user.list']), 'user.read') === false
 * ```
 */
export function permissionSetMatches(
  permissions: ReadonlySet<string>,
  code: string,
): boolean {
  if (permissions.has('*')) return true
  if (permissions.has(code)) return true
  const dotIdx = code.indexOf('.')
  if (dotIdx > 0) {
    const prefix = code.slice(0, dotIdx)
    if (permissions.has(`${prefix}.*`)) return true
  }
  return false
}
