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

// Trả về quyền của user hiện tại trên MỌI Library, tính 1 lần (đọc Permissions sheet 1 lần thay vì
// N Library x 6 action như gọi hasPermission() lặp lại) — dùng để client ẩn/hiện tính năng theo đúng
// phân quyền thay vì hiện tất cả rồi chờ lỗi 403 khi bấm (xem docs/11-permission-design.md).
function getMyPermissionMap(user) {
  const libraries = getSheetRepository(SHEETS.LIBRARIES).findAll().filter(function (l) { return l.Status === 'Active'; });
  const actions = ['CanView', 'CanCreate', 'CanEdit', 'CanDelete', 'CanApprove', 'CanManage'];

  if (!user || user.Status !== 'Active') {
    return libraries.reduce(function (map, lib) {
      map[lib.LibraryID] = actions.reduce(function (a, act) { a[act] = false; return a; }, {});
      return map;
    }, {});
  }
  if (user.Role === ROLE_NAMES.ADMIN) {
    return libraries.reduce(function (map, lib) {
      map[lib.LibraryID] = actions.reduce(function (a, act) { a[act] = true; return a; }, {});
      return map;
    }, {});
  }

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll();
  const roleGlobalRow = permissions.find(function (p) { return p.RoleID === user.Role && p.LibraryID === '*'; });

  const map = {};
  libraries.forEach(function (lib) {
    const userOverride = permissions.find(function (p) { return p.UserID === user.UserID && p.LibraryID === lib.LibraryID; });
    const roleScopedRow = permissions.find(function (p) { return p.RoleID === user.Role && p.LibraryID === lib.LibraryID; });
    const source = userOverride || roleScopedRow || roleGlobalRow;
    map[lib.LibraryID] = actions.reduce(function (a, act) { a[act] = !!(source && source[act] === true); return a; }, {});
  });
  return map;
}
