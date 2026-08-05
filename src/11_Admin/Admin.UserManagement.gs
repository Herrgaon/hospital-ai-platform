// Quản lý người dùng — xem docs/04-use-cases.md UC-08.

// Danh sách đầy đủ (kèm Role hệ thống) — dùng cho màn Admin quản lý Role, chỉ Admin xem được.
function listAllUsers(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được xem danh sách người dùng.');
  }
  return getSheetRepository(SHEETS.USERS).findAll();
}

// Danh bạ rút gọn (không có Role) — dùng để chọn người nhận quyền trong 1 Library cụ thể.
// Mở cho mọi người dùng đã đăng nhập vì bản thân việc biết tên/email đồng nghiệp trong cùng
// bệnh viện không nhạy cảm, và Trưởng khoa/phòng cần danh sách này để cấp quyền cho nhân viên
// của mình (xem setUserPermissionOverride bên dưới).
function listUserDirectory() {
  return getSheetRepository(SHEETS.USERS).findAll().map(function (u) {
    return { UserID: u.UserID, Email: u.Email, FullName: u.FullName };
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
