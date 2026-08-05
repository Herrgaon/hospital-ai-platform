// Quản lý kho tri thức — xem docs/10-knowledge-design.md.

// Tạo Library mới chỉ dành cho Admin — đúng ma trận tại docs/11-permission-design.md mục 3
// ("Tạo/Quản lý Library mới": Admin có, Manager chỉ được đề xuất). Đây là hành động cấp hệ thống,
// khác với việc quản lý nội dung TRONG một Library đã tồn tại (dùng cờ CanManage thông thường).
function createLibrary(user, libraryName, description, managerUserId, requiresReview) {
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được tạo Kho tri thức mới.');
  }
  const folder = getLibraryFolder(libraryName);
  const library = getSheetRepository(SHEETS.LIBRARIES).append({
    LibraryID: generateId('LIB'),
    LibraryName: libraryName,
    Description: description || '',
    ManagerUserID: managerUserId,
    DriveFolderID: folder.getId(),
    CreatedAt: nowIso(),
    Status: 'Active',
    RequiresReview: requiresReview !== false
  });
  logAudit(user.UserID, 'LIBRARY_CREATED', 'Library', library.LibraryID, libraryName);

  // Trưởng khoa/phòng được giao quản lý kho này có toàn quyền TRONG PHẠM VI kho đó (không phải
  // toàn hệ thống) — đúng mô hình "mỗi khoa phòng quản lý riêng kho của mình".
  if (managerUserId) {
    getSheetRepository(SHEETS.PERMISSIONS).append({
      PermissionID: generateId('PERM'),
      RoleID: '',
      UserID: managerUserId,
      LibraryID: library.LibraryID,
      CanView: true, CanCreate: true, CanEdit: true, CanDelete: true, CanApprove: true, CanManage: true
    });
  }

  return library;
}

function listLibrariesForUser(user) {
  const all = getSheetRepository(SHEETS.LIBRARIES).findAll().filter(function (l) { return l.Status === 'Active'; });
  return all.filter(function (l) { return hasPermission(user, l.LibraryID, 'CanView'); });
}
