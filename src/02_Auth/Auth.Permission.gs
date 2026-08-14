// Kiểm tra RBAC. Fail-closed: không xác định được quyền => từ chối.

function hasPermission(user, departmentId, action) {
  if (!user || user.Status !== 'Active') return false;
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) return true;

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll();

  const userOverride = permissions.find(function (p) {
    return p.UserID === user.UserID && p.DepartmentID === departmentId;
  });
  if (userOverride) return userOverride[action] === true;

  const roleScoped = permissions.find(function (p) {
    return p.RoleID === user.Role && p.DepartmentID === departmentId;
  });
  if (roleScoped) return roleScoped[action] === true;

  const roleGlobal = permissions.find(function (p) {
    return p.RoleID === user.Role && p.DepartmentID === '*';
  });
  if (roleGlobal) return roleGlobal[action] === true;

  return false;
}

function requirePermission(user, departmentId, action) {
  if (!hasPermission(user, departmentId, action)) {
    throw new Error('Không có quyền thực hiện hành động này: ' + action);
  }
}

// Trả về quyền của user hiện tại trên MỌI Khoa/Phòng, tính 1 lần (đọc Permissions sheet 1 lần thay
// vì N Khoa/Phòng x 10 action như gọi hasPermission() lặp lại) — dùng để client ẩn/hiện tính năng
// theo đúng phân quyền thay vì hiện tất cả rồi chờ lỗi khi bấm.
function getMyPermissionMap(user) {
  const departments = getSheetRepository(SHEETS.DEPARTMENTS).findAll().filter(function (d) { return d.Status === 'Active'; });
  const actions = ['CanView', 'CanCreate', 'CanEdit', 'CanDelete', 'CanSubmit', 'CanApprove', 'CanReject', 'CanPublish', 'CanLock', 'CanExport'];

  if (!user || user.Status !== 'Active') {
    return departments.reduce(function (map, dept) {
      map[dept.DepartmentID] = actions.reduce(function (a, act) { a[act] = false; return a; }, {});
      return map;
    }, {});
  }
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) {
    return departments.reduce(function (map, dept) {
      map[dept.DepartmentID] = actions.reduce(function (a, act) { a[act] = true; return a; }, {});
      return map;
    }, {});
  }

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll();
  const roleGlobalRow = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === '*'; });

  const map = {};
  departments.forEach(function (dept) {
    const userOverride = permissions.find(function (p) { return p.UserID === user.UserID && p.DepartmentID === dept.DepartmentID; });
    const roleScopedRow = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === dept.DepartmentID; });
    const source = userOverride || roleScopedRow || roleGlobalRow;
    map[dept.DepartmentID] = actions.reduce(function (a, act) { a[act] = !!(source && source[act] === true); return a; }, {});
  });
  return map;
}
