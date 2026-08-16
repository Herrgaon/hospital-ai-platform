// Quản lý người dùng.

// Danh sách đầy đủ (kèm Role hệ thống) — dùng cho màn Admin quản lý Role, chỉ SUPER_ADMIN xem được.
function listAllUsers(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem danh sách người dùng.');
  }
  return getSheetRepository(SHEETS.USERS).findAll();
}

// SUPER_ADMIN/Phòng TC-HC tạo trước tài khoản cho nhân viên chưa từng đăng nhập (ví dụ để gán
// Role/Department sẵn trước khi họ dùng lần đầu). Username là định danh đăng nhập (tách khỏi
// Employees.EmployeeCode — xem Auth.Gateway.gs), phải là duy nhất toàn hệ thống.
function createUser(actingUser, email, username, fullName, role, department) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_TC_HC) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Tổ chức – Hành chính được thêm người dùng.');
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Email không hợp lệ.');
  }
  if (isBlank(username)) {
    throw new Error('Vui lòng nhập tên đăng nhập.');
  }

  const usersRepo = getSheetRepository(SHEETS.USERS);
  const existingEmail = usersRepo.findAll().find(function (u) { return u.Email.toLowerCase() === normalizedEmail; });
  if (existingEmail) {
    throw new Error('Người dùng với email này đã tồn tại.');
  }
  const existingUsername = usersRepo.findAll().find(function (u) { return u.Username === username; });
  if (existingUsername) {
    throw new Error('Tên đăng nhập "' + username + '" đã được sử dụng.');
  }

  const user = usersRepo.append({
    UserID: generateId('USR'),
    Email: normalizedEmail,
    Username: username,
    FullName: fullName || normalizedEmail,
    Role: role || ROLE_NAMES.GUEST,
    Department: department || '',
    Status: 'Active',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
    AvatarUrl: ''
  });
  logAudit(actingUser.UserID, 'USER_CREATED', 'User', user.UserID, normalizedEmail + ' (' + username + ')');
  return user;
}

// SUPER_ADMIN sửa thông tin mô tả (tên hiển thị, phòng ban) của BẤT KỲ user nào — khác assignRole (chỉ
// đổi Role hệ thống) và updateMyProfile (user tự sửa hồ sơ của chính mình).
function updateUserProfile(actingUser, targetUserId, fullName, department) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được sửa hồ sơ người dùng khác.');
  }
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', targetUserId, {
    FullName: fullName,
    Department: department,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'USER_PROFILE_CHANGED', 'User', targetUserId, fullName);
  return updated;
}

// Danh bạ rút gọn (không có Role) — dùng để chọn nhân viên khi giao việc/phân công/xếp trực.
// Mở cho mọi người dùng đã đăng nhập vì bản thân việc biết tên/email đồng nghiệp trong cùng
// bệnh viện không nhạy cảm.
function listUserDirectory() {
  return getSheetRepository(SHEETS.USERS).findAll().map(function (u) {
    return { UserID: u.UserID, Email: u.Email, FullName: u.FullName, AvatarUrl: u.AvatarUrl, Department: u.Department };
  });
}

// --- Quản lý phân quyền tập trung (Đặc tả Cơ chế Phân quyền V1) ---
// Màn "Quản lý phân quyền" (Admin.html) vẫn CHỈ SUPER_ADMIN truy cập được — mô hình "Trưởng khoa tự
// phân quyền cho thành viên qua UI" (đặc tả §16) CHƯA mở ở V1 này, giữ nguyên quyết định "Giai đoạn 1"
// trước đây (chỉ Admin thao tác qua UI). NHƯNG grantUserPermission() vẫn ép buộc nguyên tắc "không
// cấp vượt quá quyền mình có + phải được phép uỷ quyền" (đúng §13/§14) cho MỌI actingUser, không riêng
// SUPER_ADMIN — chuẩn bị sẵn cho lúc mở UI cho Trưởng khoa sau này mà không phải sửa lại logic gốc.
function requirePermissionManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được quản lý phân quyền.');
  }
}

// Toàn bộ dòng phân quyền CÁ NHÂN (UserID cụ thể, không phải mặc định theo Role) của 1 người, ở MỌI
// khoa/phòng — đúng §7 "màn quản lý phân quyền tập trung", thay cho model cũ chỉ xem theo 1 khoa/phòng
// tại 1 thời điểm.
function listPermissionsForUser(actingUser, targetUserId) {
  requirePermissionManager_(actingUser);
  return getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(function (p) { return p.UserID === targetUserId; });
}

// Cấp/điều chỉnh quyền cho 1 người tại 1 phạm vi + 1 MODULE (Khoa/Phòng hoặc '*' = Toàn viện) — đúng
// §3 "Quyền + Phạm vi", §6 "cấp trực tiếp không cần đổi chức vụ", §19 "cho phép có thời hạn". Mỗi
// module là 1 dòng RIÊNG (đúng key UserID+DepartmentID+Module) — "Xem lịch trực" (module DUTY_SCHEDULE)
// và "Xem công việc" (module TASK) không còn chung 1 cờ, dù cùng 1 người + cùng khoa/phòng. patch chỉ
// gồm các hành động ĐANG ĐƯỢC BẬT (true) trong lượt cấp này — dùng để kiểm tra uỷ quyền, không phải
// toàn bộ 10 hành động của dòng kết quả.
function grantUserPermission(actingUser, targetUserId, departmentId, module, patch, options) {
  var mod = module || '';
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    // Đúng §13-14: không được cấp quyền mình không có, và quyền đó phải Cho phép phân quyền = Có.
    var grantedActions = Object.keys(patch).filter(function (a) { return patch[a] === true; });
    grantedActions.forEach(function (action) {
      if (!hasPermission(actingUser, departmentId, action, mod)) {
        throw new Error('Bạn không có quyền "' + action + '" ở phạm vi này nên không thể cấp lại cho người khác.');
      }
      if (!hasDelegatablePermission_(actingUser, departmentId, action, mod)) {
        throw new Error('Quyền "' + action + '" của bạn không được phép uỷ quyền lại cho người khác.');
      }
    });
  }

  var opts = options || {};
  var permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  var existing = permissionsRepo.findAll().find(function (p) {
    return p.UserID === targetUserId && p.DepartmentID === departmentId && (p.Module || '') === mod;
  });

  var writePatch = Object.assign({}, patch, {
    Status: 'Active',
    EffectiveFrom: opts.effectiveFrom || '',
    EffectiveTo: opts.effectiveTo || '',
    CanDelegate: !!opts.canDelegate,
    GrantedByUserID: actingUser.UserID,
    GrantedAt: nowIso(),
    Note: opts.note || ''
  });

  var result;
  if (existing) {
    result = permissionsRepo.updateById('PermissionID', existing.PermissionID, writePatch);
  } else {
    result = permissionsRepo.append(Object.assign({
      PermissionID: generateId('PERM'), RoleID: '', UserID: targetUserId, DepartmentID: departmentId, Module: mod
    }, writePatch));
  }
  logAudit(actingUser.UserID, 'PERMISSION_GRANTED', 'User', targetUserId,
    'Nhóm quyền: ' + getPermissionModuleLabel_(mod) + ' — Phạm vi: ' + (departmentId === '*' ? 'Toàn viện' : departmentId) + ' — ' + JSON.stringify(patch) +
    (opts.effectiveTo ? ' (có thời hạn đến ' + opts.effectiveTo + ')' : ''));
  return result;
}

// Thu hồi (đúng §10) — KHÔNG xoá dòng, chỉ chuyển Status='Revoked' để giữ lịch sử + cho phép khôi
// phục. Thu hồi 1 người không ảnh hưởng người khác cùng chức vụ (đúng bản chất "cấp theo từng người",
// không có khái niệm "gỡ theo chức vụ").
function revokePermissionGrant(actingUser, permissionId) {
  requirePermissionManager_(actingUser);
  var permission = getSheetRepository(SHEETS.PERMISSIONS).findById('PermissionID', permissionId);
  if (!permission) throw new Error('Không tìm thấy bản ghi phân quyền.');
  var updated = getSheetRepository(SHEETS.PERMISSIONS).updateById('PermissionID', permissionId, { Status: 'Revoked' });
  logAudit(actingUser.UserID, 'PERMISSION_REVOKED', 'User', permission.UserID, 'Phạm vi: ' + permission.DepartmentID);
  return updated;
}

function restorePermissionGrant(actingUser, permissionId) {
  requirePermissionManager_(actingUser);
  var permission = getSheetRepository(SHEETS.PERMISSIONS).findById('PermissionID', permissionId);
  if (!permission) throw new Error('Không tìm thấy bản ghi phân quyền.');
  var updated = getSheetRepository(SHEETS.PERMISSIONS).updateById('PermissionID', permissionId, { Status: 'Active' });
  logAudit(actingUser.UserID, 'PERMISSION_RESTORED', 'User', permission.UserID, 'Phạm vi: ' + permission.DepartmentID);
  return updated;
}

// Nhật ký phân quyền (đúng §18) — dùng lại AuditLog chung, KHÔNG lưu trùng 1 bảng lịch sử riêng, lọc
// theo đúng 3 hành động phân quyền + đúng người bị tác động.
function listPermissionChangeHistory(actingUser, targetUserId) {
  requirePermissionManager_(actingUser);
  var actions = ['PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'PERMISSION_RESTORED'];
  return getSheetRepository(SHEETS.AUDIT_LOG).findAll()
    .filter(function (log) { return actions.indexOf(log.Action) !== -1 && log.TargetID === targetUserId; })
    .sort(function (a, b) { return a.Timestamp < b.Timestamp ? 1 : -1; });
}
