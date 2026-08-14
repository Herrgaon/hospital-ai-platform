// Quản lý người dùng.

// Danh sách đầy đủ (kèm Role hệ thống) — dùng cho màn Admin quản lý Role, chỉ SUPER_ADMIN xem được.
function listAllUsers(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem danh sách người dùng.');
  }
  return getSheetRepository(SHEETS.USERS).findAll();
}

// SUPER_ADMIN/Phòng TC-HC tạo trước tài khoản cho nhân viên chưa từng đăng nhập (ví dụ để gán
// Role/Department sẵn trước khi họ dùng lần đầu). getCurrentUser() (Auth.Session.gs) tìm theo Email
// nên khi người đó đăng nhập thật, hệ thống nhận đúng bản ghi này thay vì tự tạo mới với Role=Guest.
function createUser(actingUser, email, fullName, role, department) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_TC_HC) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Tổ chức – Hành chính được thêm người dùng.');
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Email không hợp lệ.');
  }

  const usersRepo = getSheetRepository(SHEETS.USERS);
  const existing = usersRepo.findAll().find(function (u) { return u.Email.toLowerCase() === normalizedEmail; });
  if (existing) {
    throw new Error('Người dùng với email này đã tồn tại.');
  }

  const user = usersRepo.append({
    UserID: generateId('USR'),
    Email: normalizedEmail,
    FullName: fullName || normalizedEmail,
    Role: role || ROLE_NAMES.GUEST,
    Department: department || '',
    Status: 'Active',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
    AvatarUrl: ''
  });
  logAudit(actingUser.UserID, 'USER_CREATED', 'User', user.UserID, normalizedEmail);
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

// Giai đoạn 1: gán/thu quyền theo Khoa/Phòng chỉ do SUPER_ADMIN thực hiện (phân quyền uỷ quyền phi
// tập trung — ví dụ để Trưởng khoa tự cấp quyền cho nhân viên của mình — bị hoãn lại, xem quyết định
// trong kế hoạch triển khai). Quyền của Trưởng khoa/Phó khoa/Người lập lịch trực được tự động seed
// theo từng Khoa/Phòng khi gán HeadUserID, xem Department.Service.gs.
function setEmployeePermissionOverride(actingUser, targetUserId, departmentId, permissionPatch) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được phân quyền theo khoa/phòng.');
  }

  const permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  const existing = permissionsRepo.findAll().find(function (p) {
    return p.UserID === targetUserId && p.DepartmentID === departmentId;
  });

  if (existing) {
    permissionsRepo.updateById('PermissionID', existing.PermissionID, permissionPatch);
  } else {
    permissionsRepo.append(Object.assign({
      PermissionID: generateId('PERM'),
      RoleID: '',
      UserID: targetUserId,
      DepartmentID: departmentId
    }, permissionPatch));
  }
  logAudit(actingUser.UserID, 'PERMISSION_CHANGED', 'User', targetUserId, 'Khoa/Phòng: ' + departmentId);
}

function listPermissionsForDepartment(actingUser, departmentId) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem phân quyền của khoa/phòng.');
  }
  return getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(function (p) {
    return p.DepartmentID === departmentId && !isBlank(p.UserID);
  });
}
