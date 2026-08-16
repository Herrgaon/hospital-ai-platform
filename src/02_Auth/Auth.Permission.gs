// Kiểm tra RBAC. Fail-closed: không xác định được quyền => từ chối.
// "Quyền dùng chung toàn hệ thống + Phạm vi quản lý" đúng Đặc tả Cơ chế Phân quyền V1 §1: 10 hành
// động (CanView...CanExport) là KHO QUYỀN DÙNG CHUNG, không có hành động nào gắn cứng theo khoa/phòng
// cụ thể — DepartmentID trên mỗi dòng Permissions chỉ là PHẠM VI ('*' = toàn viện). Role không tự động
// "toàn quyền" (đúng §2) — 1 dòng theo RoleID vẫn phải được cấu hình rõ hành động nào = true, không có
// logic ngầm định "Trưởng khoa thì được làm X".

// Dòng cấp quyền còn hiệu lực = Status khác 'Revoked' (rỗng coi là Active — dữ liệu cũ trước khi có
// cột này) VÀ (không có EffectiveFrom hoặc đã tới ngày) VÀ (không có EffectiveTo hoặc chưa quá hạn) —
// đúng §19 "cho phép cấp quyền có thời hạn, hết hạn tự động hết hiệu lực".
function isPermissionRowActive_(p) {
  if (p.Status === 'Revoked') return false;
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  if (p.EffectiveFrom && todayStr < p.EffectiveFrom) return false;
  if (p.EffectiveTo && todayStr > p.EffectiveTo) return false;
  return true;
}

function hasPermission(user, departmentId, action) {
  if (!user || user.Status !== 'Active') return false;
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) return true;

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(isPermissionRowActive_);

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

// "Cho phép phân quyền" (đặc tả §12-14) — quyền ĐANG CÓ của user chỉ được uỷ quyền lại cho người khác
// nếu dòng cấp quyền (đúng dòng đang cho hasPermission() trả về true ở scope này) có CanDelegate=true.
// Áp dụng CẢ CHO user thường lẫn SUPER_ADMIN gọi thay mặt — nhưng SUPER_ADMIN được bỏ qua ở
// grantUserPermission (không cần đi qua đường uỷ quyền, luôn có toàn quyền gốc).
function hasDelegatablePermission_(user, departmentId, action) {
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) return true;
  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(isPermissionRowActive_);
  const source = permissions.find(function (p) { return p.UserID === user.UserID && p.DepartmentID === departmentId; }) ||
    permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === departmentId; }) ||
    permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === '*'; });
  return !!(source && source[action] === true && source.CanDelegate === true);
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

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(isPermissionRowActive_);
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
