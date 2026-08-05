// Kiểm tra RBAC — xem docs/11-permission-design.md. Fail-closed: không xác định được quyền => từ chối.

function hasPermission(user, libraryId, action) {
  if (!user || user.Status !== 'Active') return false;
  if (user.Role === ROLE_NAMES.ADMIN) return true;

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll();

  const userOverride = permissions.find(function (p) {
    return p.UserID === user.UserID && p.LibraryID === libraryId;
  });
  if (userOverride) return userOverride[action] === true;

  const roleScoped = permissions.find(function (p) {
    return p.RoleID === user.Role && p.LibraryID === libraryId;
  });
  if (roleScoped) return roleScoped[action] === true;

  const roleGlobal = permissions.find(function (p) {
    return p.RoleID === user.Role && p.LibraryID === '*';
  });
  if (roleGlobal) return roleGlobal[action] === true;

  return false;
}

function requirePermission(user, libraryId, action) {
  if (!hasPermission(user, libraryId, action)) {
    throw new Error('Không có quyền thực hiện hành động này: ' + action);
  }
}
