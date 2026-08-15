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

// "Cơ cấu tổ chức" (đặc tả Tái cấu trúc Nhân sự V1 §12) — dựng cây từ ParentDepartmentID đã có sẵn
// trên Departments (không cần thêm cột mới). Đơn vị không xác định được cha (ParentDepartmentID rỗng
// hoặc trỏ tới ID không tồn tại/không Active) coi là gốc — tránh cây "biến mất" 1 nhánh nếu dữ liệu cũ
// có ParentDepartmentID mồ côi.
function getOrganizationTree() {
  const departments = listActiveDepartments();
  const byId = {};
  departments.forEach(function (d) { byId[d.DepartmentID] = Object.assign({}, d, { children: [] }); });
  const roots = [];
  departments.forEach(function (d) {
    const node = byId[d.DepartmentID];
    if (d.ParentDepartmentID && byId[d.ParentDepartmentID]) {
      byId[d.ParentDepartmentID].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// Thông tin 1 khoa/phòng khi mở trong "Cơ cấu tổ chức" (§13) — Trưởng khoa/phòng lấy từ HeadUserID
// (quan hệ đã có sẵn, đáng tin cậy hơn so khớp chuỗi JobTitle). "leadershipByJobTitle" nhóm các nhân sự
// còn lại theo Chức vụ THỰC TẾ đang có trong đơn vị (không hard-code tên "Phó khoa"/"Điều dưỡng
// trưởng" — đúng yêu cầu "chức vụ nào thực tế không có thì không hiển thị", chức vụ nào tồn tại thì tự
// nhiên xuất hiện).
function getDepartmentDetail(departmentId) {
  const department = getDepartmentById(departmentId);
  if (!department) throw new Error('Không tìm thấy khoa/phòng.');
  const employees = listEmployeesByDepartment(departmentId).filter(function (e) { return e.Status !== 'Inactive'; });
  const headEmployee = department.HeadUserID ? getEmployeeByUserId_(department.HeadUserID) : null;

  const leadershipMap = {};
  employees.forEach(function (e) {
    if (!e.JobTitle || (headEmployee && e.EmployeeID === headEmployee.EmployeeID)) return;
    if (!leadershipMap[e.JobTitle]) leadershipMap[e.JobTitle] = [];
    leadershipMap[e.JobTitle].push(e);
  });
  const leadershipByJobTitle = Object.keys(leadershipMap).map(function (jobTitle) {
    return { jobTitle: jobTitle, employees: leadershipMap[jobTitle] };
  });

  return {
    department: department, headEmployee: headEmployee,
    employeeCount: employees.length, employees: employees,
    leadershipByJobTitle: leadershipByJobTitle
  };
}
