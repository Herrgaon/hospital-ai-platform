// Kiểm tra RBAC. Fail-closed: không xác định được quyền => từ chối.
// "Quyền dùng chung toàn hệ thống + Phạm vi quản lý" đúng Đặc tả Cơ chế Phân quyền V1 §1: 10 hành
// động (CanView...CanExport) là KHO QUYỀN DÙNG CHUNG, không có hành động nào gắn cứng theo khoa/phòng
// cụ thể — DepartmentID trên mỗi dòng Permissions chỉ là PHẠM VI ('*' = toàn viện). Role không tự động
// "toàn quyền" (đúng §2) — 1 dòng theo RoleID vẫn phải được cấu hình rõ hành động nào = true, không có
// logic ngầm định "Trưởng khoa thì được làm X".
//
// 2026-08-16: bổ sung MODULE — "Xem lịch trực" và "Xem công việc" giờ là 2 quyền HOÀN TOÀN ĐỘC LẬP
// (trước đó gộp chung 1 cờ CanView cho mọi module, sai theo phản hồi Product Owner). module='' vẫn
// được TRUYỀN VÀO ĐƯỢC (mặc định) để không phá vỡ các lời gọi requirePermission() cũ chưa migrate —
// resolvePermissionRow_ luôn ưu tiên dòng ĐÚNG module trước, sau đó mới rơi về dòng module='' (kiểu cũ)
// làm phương án dự phòng, đảm bảo KHÔNG mất quyền đã cấp trước khi có cột Module.

function isPermissionRowActive_(p) {
  if (p.Status === 'Revoked') return false;
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  if (p.EffectiveFrom && todayStr < p.EffectiveFrom) return false;
  if (p.EffectiveTo && todayStr > p.EffectiveTo) return false;
  return true;
}

// Tìm dòng cấp quyền áp dụng cho (user, departmentId, module) theo đúng thứ tự ưu tiên: cấp riêng cho
// USER + đúng module > cấp riêng cho USER + module cũ (rỗng) > theo ROLE + khoa/phòng + đúng module >
// theo ROLE + khoa/phòng + module cũ > theo ROLE + toàn viện + đúng module > theo ROLE + toàn viện +
// module cũ.
function resolvePermissionRow_(permissions, user, departmentId, module) {
  const m = module || '';
  const byUserExact = permissions.find(function (p) { return p.UserID === user.UserID && p.DepartmentID === departmentId && p.Module === m; });
  if (byUserExact) return byUserExact;
  if (m) {
    const byUserLegacy = permissions.find(function (p) { return p.UserID === user.UserID && p.DepartmentID === departmentId && !p.Module; });
    if (byUserLegacy) return byUserLegacy;
  }

  const byRoleDeptExact = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === departmentId && p.Module === m; });
  if (byRoleDeptExact) return byRoleDeptExact;
  if (m) {
    const byRoleDeptLegacy = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === departmentId && !p.Module; });
    if (byRoleDeptLegacy) return byRoleDeptLegacy;
  }

  const byRoleGlobalExact = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === '*' && p.Module === m; });
  if (byRoleGlobalExact) return byRoleGlobalExact;
  if (m) {
    const byRoleGlobalLegacy = permissions.find(function (p) { return p.RoleID === user.Role && p.DepartmentID === '*' && !p.Module; });
    if (byRoleGlobalLegacy) return byRoleGlobalLegacy;
  }
  return null;
}

// module: tuỳ chọn (đúng key trong PERMISSION_MODULES_, xem Auth.PermissionCatalog.gs) — bỏ trống =
// hành vi CŨ (1 quyền dùng chung mọi module, dành cho các Service CHƯA migrate sang module riêng).
function hasPermission(user, departmentId, action, module) {
  if (!user || user.Status !== 'Active') return false;
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) return true;

  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(isPermissionRowActive_);
  const source = resolvePermissionRow_(permissions, user, departmentId, module);
  return !!(source && source[action] === true);
}

function requirePermission(user, departmentId, action, module) {
  if (!hasPermission(user, departmentId, action, module)) {
    const label = module ? getPermissionModuleLabel_(module) + ' — ' : '';
    throw new Error('Không có quyền thực hiện hành động này: ' + label + action);
  }
}

// "Cho phép phân quyền" (đặc tả §12-14) — quyền ĐANG CÓ của user chỉ được uỷ quyền lại cho người khác
// nếu dòng cấp quyền (đúng dòng đang cho hasPermission() trả về true ở scope này) có CanDelegate=true.
function hasDelegatablePermission_(user, departmentId, action, module) {
  if (user.Role === ROLE_NAMES.SUPER_ADMIN) return true;
  const permissions = getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(isPermissionRowActive_);
  const source = resolvePermissionRow_(permissions, user, departmentId, module);
  return !!(source && source[action] === true && source.CanDelegate === true);
}

// Trả về quyền của user hiện tại trên MỌI Khoa/Phòng, tính 1 lần (đọc Permissions sheet 1 lần thay
// vì N Khoa/Phòng x 10 action như gọi hasPermission() lặp lại) — dùng để client ẩn/hiện tính năng
// theo đúng phân quyền thay vì hiện tất cả rồi chờ lỗi khi bấm. module: tuỳ chọn — bỏ trống dùng cho
// UI cũ (nút ẩn/hiện chung), CÓ module dùng cho UI đã tách theo từng trang chức năng.
function getMyPermissionMap(user, module) {
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
  const map = {};
  departments.forEach(function (dept) {
    const source = resolvePermissionRow_(permissions, user, dept.DepartmentID, module);
    map[dept.DepartmentID] = actions.reduce(function (a, act) { a[act] = !!(source && source[act] === true); return a; }, {});
  });
  return map;
}
