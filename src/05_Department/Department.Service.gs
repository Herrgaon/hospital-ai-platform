// Khoa/Phòng — vừa là danh mục tổ chức (cấu hình được, không hard-code) vừa là phạm vi phân quyền
// (DepartmentID dùng trực tiếp làm departmentId trong Auth.Permission.gs). Xem seed 14 khoa/phòng
// mặc định tại Bootstrap.Defaults.gs#getDefaultDepartments_.

function requireDepartmentManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_TC_HC) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Tổ chức – Hành chính được quản lý danh mục khoa/phòng.');
  }
}

// Khi gán HeadUserID (Trưởng khoa/phòng), tự seed 1 dòng Permissions phạm vi riêng cho khoa đó —
// đúng cách Knowledge.Library.gs#createLibrary từng seed cho managerUserId (mô hình cũ), chuyển
// tiếp sang mô hình mới. Quyền của Trưởng khoa: Xem/Tạo/Sửa/GửiDuyệt/Duyệt/TừChối/XuấtDữLiệu = true,
// Xóa/CôngBố/Chốt = false (chỉ Phòng KH-NV mới Công bố lịch trực chính thức toàn viện).
function seedHeadPermission_(departmentId, headUserId) {
  if (isBlank(headUserId)) return;
  const permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  const existing = permissionsRepo.findAll().find(function (p) { return p.UserID === headUserId && p.DepartmentID === departmentId; });
  const grant = {
    CanView: true, CanCreate: true, CanEdit: true, CanDelete: false,
    CanSubmit: true, CanApprove: true, CanReject: true, CanPublish: false, CanLock: false, CanExport: true
  };
  if (existing) {
    permissionsRepo.updateById('PermissionID', existing.PermissionID, grant);
  } else {
    permissionsRepo.append(Object.assign({ PermissionID: generateId('PERM'), RoleID: '', UserID: headUserId, DepartmentID: departmentId }, grant));
  }
}

function createDepartment(actingUser, input) {
  requireDepartmentManager_(actingUser);
  if (isBlank(input.departmentName) || isBlank(input.departmentType)) {
    throw new Error('Thiếu tên khoa/phòng hoặc loại khoa/phòng.');
  }
  const department = getSheetRepository(SHEETS.DEPARTMENTS).append({
    DepartmentID: generateId('DEPT'),
    DepartmentName: input.departmentName,
    DepartmentType: input.departmentType,
    ParentDepartmentID: input.parentDepartmentId || '',
    HeadUserID: input.headUserId || '',
    Status: 'Active',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  });
  seedHeadPermission_(department.DepartmentID, input.headUserId);
  logAudit(actingUser.UserID, 'DEPARTMENT_CREATED', 'Department', department.DepartmentID, input.departmentName);
  return department;
}

function updateDepartment(actingUser, departmentId, patch) {
  requireDepartmentManager_(actingUser);
  const current = getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', departmentId);
  if (!current) throw new Error('Không tìm thấy khoa/phòng.');

  const updated = getSheetRepository(SHEETS.DEPARTMENTS).updateById('DepartmentID', departmentId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  if (patch.headUserId !== undefined && patch.headUserId !== current.HeadUserID) {
    seedHeadPermission_(departmentId, patch.headUserId);
  }
  logAudit(actingUser.UserID, 'DEPARTMENT_UPDATED', 'Department', departmentId, JSON.stringify(patch));
  return updated;
}

function deactivateDepartment(actingUser, departmentId) {
  requireDepartmentManager_(actingUser);
  const updated = getSheetRepository(SHEETS.DEPARTMENTS).updateById('DepartmentID', departmentId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy khoa/phòng.');
  logAudit(actingUser.UserID, 'DEPARTMENT_DEACTIVATED', 'Department', departmentId, '');
  return updated;
}

// Đọc mở cho mọi người dùng đã đăng nhập — cần cho mọi dropdown chọn khoa/phòng. DepartmentID-scoped
// permission chỉ chặn NỘI DUNG (Task/ClinicalAssignment/DutySchedule) trong khoa đó, không chặn việc
// biết danh mục khoa/phòng nào tồn tại (giống listUserDirectory).
function listActiveDepartments() {
  return getSheetRepository(SHEETS.DEPARTMENTS).findAll().filter(function (d) { return d.Status === 'Active'; });
}

function getDepartmentById(departmentId) {
  return getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', departmentId);
}
