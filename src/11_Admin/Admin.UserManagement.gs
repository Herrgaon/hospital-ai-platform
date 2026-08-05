// Quản lý người dùng — xem docs/04-use-cases.md UC-08.

// Danh sách đầy đủ (kèm Role hệ thống) — dùng cho màn Admin quản lý Role, chỉ Admin xem được.
function listAllUsers(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được xem danh sách người dùng.');
  }
  return getSheetRepository(SHEETS.USERS).findAll();
}

// Admin tạo trước tài khoản cho nhân viên chưa từng đăng nhập (ví dụ để gán Role/Department sẵn
// trước khi họ dùng lần đầu). getCurrentUser() (Auth.Session.gs) tìm theo Email nên khi người đó
// đăng nhập thật, hệ thống nhận đúng bản ghi này thay vì tự tạo mới với Role=Guest.
function createUser(actingUser, email, fullName, role, department) {
  if (actingUser.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được thêm người dùng.');
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

// Admin sửa thông tin mô tả (tên hiển thị, phòng ban) của BẤT KỲ user nào — khác assignRole (chỉ
// đổi Role hệ thống) và updateMyProfile bên dưới (user tự sửa hồ sơ của chính mình).
function updateUserProfile(actingUser, targetUserId, fullName, department) {
  if (actingUser.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được sửa hồ sơ người dùng khác.');
  }
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', targetUserId, {
    FullName: fullName,
    Department: department,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'USER_PROFILE_CHANGED', 'User', targetUserId, fullName);
  return updated;
}

// Danh bạ rút gọn (không có Role) — dùng để chọn người nhận quyền trong 1 Library cụ thể.
// Mở cho mọi người dùng đã đăng nhập vì bản thân việc biết tên/email đồng nghiệp trong cùng
// bệnh viện không nhạy cảm, và Trưởng khoa/phòng cần danh sách này để cấp quyền cho nhân viên
// của mình (xem setUserPermissionOverride bên dưới).
function listUserDirectory() {
  return getSheetRepository(SHEETS.USERS).findAll().map(function (u) {
    return { UserID: u.UserID, Email: u.Email, FullName: u.FullName, AvatarUrl: u.AvatarUrl, Department: u.Department };
  });
}

// Đúng mô hình "mỗi khoa/phòng quản lý riêng kho của mình" (Product Owner, 2026-08-05):
// Admin phân quyền được ở bất kỳ Library nào; ngoài ra, người đang có CanManage trên MỘT Library
// cụ thể (ví dụ Trưởng khoa được gán quản lý kho của khoa mình — xem Knowledge.Library.gs#createLibrary)
// cũng được cấp/thu quyền cho nhân viên khác NHƯNG chỉ trong phạm vi chính Library đó, không lan sang
// Library khác.
function setUserPermissionOverride(actingUser, targetUserId, libraryId, permissionPatch) {
  const isSystemAdmin = actingUser.Role === ROLE_NAMES.ADMIN;
  const isScopedManager = hasPermission(actingUser, libraryId, 'CanManage');
  if (!isSystemAdmin && !isScopedManager) {
    throw new Error('Bạn không có quyền phân quyền trong kho tri thức này.');
  }

  const permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  const existing = permissionsRepo.findAll().find(function (p) {
    return p.UserID === targetUserId && p.LibraryID === libraryId;
  });

  if (existing) {
    permissionsRepo.updateById('PermissionID', existing.PermissionID, permissionPatch);
  } else {
    permissionsRepo.append(Object.assign({
      PermissionID: generateId('PERM'),
      RoleID: '',
      UserID: targetUserId,
      LibraryID: libraryId
    }, permissionPatch));
  }
  logAudit(actingUser.UserID, 'PERMISSION_CHANGED', 'User', targetUserId, 'Library: ' + libraryId);
}

function listPermissionsForLibrary(actingUser, libraryId) {
  const isSystemAdmin = actingUser.Role === ROLE_NAMES.ADMIN;
  const isScopedManager = hasPermission(actingUser, libraryId, 'CanManage');
  if (!isSystemAdmin && !isScopedManager) {
    throw new Error('Bạn không có quyền xem phân quyền của kho tri thức này.');
  }
  return getSheetRepository(SHEETS.PERMISSIONS).findAll().filter(function (p) {
    return p.LibraryID === libraryId && !isBlank(p.UserID);
  });
}
