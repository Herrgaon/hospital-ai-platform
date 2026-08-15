// Hồ sơ nhân viên trung tâm — 1 nhân viên = 1 bản ghi Employees, tham chiếu qua EmployeeID từ mọi
// module khác (Task/ClinicalAssignment/DutySchedule). Danh tính đăng nhập vẫn thuộc Users (UserID),
// không lặp lại quản lý định danh — dùng lại createUser (Admin.UserManagement.gs) để get-or-create
// bản ghi Users trước khi tạo Employees.

function requireEmployeeManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_TC_HC) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Tổ chức – Hành chính được quản lý hồ sơ nhân viên.');
  }
}

function findOrCreateUserForEmployee_(actingUser, email, username, fullName, departmentName) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = getSheetRepository(SHEETS.USERS).findAll().find(function (u) { return u.Email.toLowerCase() === normalizedEmail; });
  if (existing) return existing;
  return createUser(actingUser, normalizedEmail, username, fullName, ROLE_NAMES.NHAN_VIEN, departmentName || '');
}

function createEmployee(actingUser, input) {
  requireEmployeeManager_(actingUser);
  if (isBlank(input.email) || isBlank(input.username) || isBlank(input.fullName) || isBlank(input.departmentId) || isBlank(input.employeeCode)) {
    throw new Error('Thiếu thông tin bắt buộc: tên đăng nhập, mã nhân viên, email, họ tên hoặc khoa/phòng.');
  }
  const department = getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', input.departmentId);
  if (!department) throw new Error('Khoa/Phòng không tồn tại.');

  const employeesRepo = getSheetRepository(SHEETS.EMPLOYEES);
  const duplicateCode = employeesRepo.findAll().find(function (e) { return e.EmployeeCode === input.employeeCode; });
  if (duplicateCode) throw new Error('Mã nhân viên "' + input.employeeCode + '" đã được sử dụng.');

  const user = findOrCreateUserForEmployee_(actingUser, input.email, input.username, input.fullName, department.DepartmentName);
  const existingEmployee = employeesRepo.findAll().find(function (e) { return e.UserID === user.UserID; });
  if (existingEmployee) {
    throw new Error('Người dùng này đã có hồ sơ nhân viên.');
  }

  const employee = employeesRepo.append({
    EmployeeID: generateId('EMP'),
    EmployeeCode: input.employeeCode,
    UserID: user.UserID,
    FullName: input.fullName,
    DepartmentID: input.departmentId,
    Position: input.position || '',
    JobTitle: input.jobTitle || '',
    EmployeeType: input.employeeType || '',
    PhoneNumber: input.phoneNumber || '',
    Email: user.Email,
    StartDate: input.startDate || '',
    Status: 'Active',
    RecordOwnerUserID: input.recordOwnerUserId || '',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'EMPLOYEE_CREATED', 'Employee', employee.EmployeeID, input.fullName + ' (' + input.employeeCode + ')');
  return employee;
}

// SUPER_ADMIN/Phòng TC-HC đặt/đặt lại mật khẩu ban đầu cho nhân viên (mô hình "HR đặt mật khẩu tạm,
// nhân viên tự đổi sau" — không xây luồng tự đăng ký/quên mật khẩu qua email ở giai đoạn này, xem
// báo cáo thẩm định kiến trúc mục "thay đổi nên làm").
function resetEmployeePassword(actingUser, employeeId, newPassword) {
  requireEmployeeManager_(actingUser);
  if (!isValidPassword_(newPassword)) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');

  const employee = getSheetRepository(SHEETS.EMPLOYEES).findById('EmployeeID', employeeId);
  if (!employee) throw new Error('Không tìm thấy nhân viên.');

  const hashed = hashPassword_(newPassword);
  getSheetRepository(SHEETS.USERS).updateById('UserID', employee.UserID, {
    PasswordHash: hashed.hash, PasswordSalt: hashed.salt, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'USER_PASSWORD_RESET', 'Employee', employeeId, 'Đặt lại bởi ' + actingUser.FullName);
  return { success: true };
}

// Tự đổi mật khẩu của chính mình — bắt buộc xác thực lại mật khẩu cũ (đúng yêu cầu đặc tả, tránh 1
// phiên đang mở bị lợi dụng đổi mật khẩu mà chủ tài khoản không hay biết).
function changeMyPassword(user, oldPassword, newPassword) {
  if (!isValidPassword_(newPassword)) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
  if (isBlank(user.PasswordHash) || !verifyPassword_(oldPassword, user.PasswordHash, user.PasswordSalt)) {
    throw new Error('Mật khẩu hiện tại không đúng.');
  }
  const hashed = hashPassword_(newPassword);
  getSheetRepository(SHEETS.USERS).updateById('UserID', user.UserID, {
    PasswordHash: hashed.hash, PasswordSalt: hashed.salt, UpdatedAt: nowIso()
  });
  logAudit(user.UserID, 'USER_PASSWORD_CHANGED', 'User', user.UserID, '');
  return { success: true };
}

function updateEmployee(actingUser, employeeId, patch) {
  requireEmployeeManager_(actingUser);
  const updated = getSheetRepository(SHEETS.EMPLOYEES).updateById('EmployeeID', employeeId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  if (!updated) throw new Error('Không tìm thấy nhân viên.');
  logAudit(actingUser.UserID, 'EMPLOYEE_UPDATED', 'Employee', employeeId, JSON.stringify(patch));
  return updated;
}

// Vô hiệu hoá đồng thời khoá đăng nhập (Users.Status) — hasPermission() từ chối user Status !=
// 'Active' nên nhân viên nghỉ việc mất quyền truy cập ngay, không chỉ ẩn khỏi danh sách.
function deactivateEmployee(actingUser, employeeId) {
  requireEmployeeManager_(actingUser);
  const employee = getSheetRepository(SHEETS.EMPLOYEES).findById('EmployeeID', employeeId);
  if (!employee) throw new Error('Không tìm thấy nhân viên.');
  getSheetRepository(SHEETS.EMPLOYEES).updateById('EmployeeID', employeeId, { Status: 'Inactive', UpdatedAt: nowIso() });
  getSheetRepository(SHEETS.USERS).updateById('UserID', employee.UserID, { Status: 'Inactive', UpdatedAt: nowIso() });
  invalidateUserLookupCache_(employee.UserID);
  logAudit(actingUser.UserID, 'EMPLOYEE_DEACTIVATED', 'Employee', employeeId, employee.FullName);
  return { success: true };
}

function listEmployees() {
  return getSheetRepository(SHEETS.EMPLOYEES).findAll();
}

// Nhập nhanh nhiều nhân viên qua CSV dán tay (cùng mẫu "dán CSV" đã dùng ở Số liệu chuyên môn — chưa
// phải import file Excel nhị phân thật, xem HIEN_TRANG_HE_THONG.md mục "Chưa làm"). Khoa/Phòng xác
// định qua TÊN (không phải ID) vì đó là thứ HR gõ tay quen thuộc, không phải mã nội bộ hệ thống.
function importEmployees(actingUser, rows) {
  requireEmployeeManager_(actingUser);
  const departments = getSheetRepository(SHEETS.DEPARTMENTS).findAll();
  const results = rows.map(function (row) {
    const department = departments.find(function (d) { return d.DepartmentName === row.departmentName; });
    if (!department) return { employeeCode: row.employeeCode, success: false, error: 'Không tìm thấy khoa/phòng "' + row.departmentName + '".' };
    try {
      const employee = createEmployee(actingUser, {
        employeeCode: row.employeeCode, username: row.username, email: row.email, fullName: row.fullName,
        departmentId: department.DepartmentID, position: row.position || '', jobTitle: row.jobTitle || '',
        employeeType: row.employeeType || '', phoneNumber: row.phoneNumber || '', startDate: row.startDate || ''
      });
      return { employeeCode: row.employeeCode, success: true, employeeId: employee.EmployeeID };
    } catch (e) {
      return { employeeCode: row.employeeCode, success: false, error: e.message };
    }
  });
  logAudit(actingUser.UserID, 'EMPLOYEE_IMPORTED', 'Employee', '*', results.length + ' dòng, ' +
    results.filter(function (r) { return r.success; }).length + ' thành công');
  return results;
}

function exportEmployeesToExcel(actingUser) {
  requireEmployeeManager_(actingUser);
  const employees = listEmployees();
  const departments = getSheetRepository(SHEETS.DEPARTMENTS).findAll();
  const departmentNameById_ = function (id) {
    const d = departments.find(function (x) { return x.DepartmentID === id; });
    return d ? d.DepartmentName : '';
  };

  const tempSpreadsheet = SpreadsheetApp.create('DanhSachNhanSu_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss'));
  const sheet = tempSpreadsheet.getSheets()[0];
  const headers = ['Mã NV', 'Họ tên', 'Khoa/Phòng', 'Chức danh', 'Chức vụ', 'Loại nhân viên', 'SĐT', 'Email', 'Trạng thái'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (employees.length > 0) {
    const values = employees.map(function (e) {
      return [e.EmployeeCode, e.FullName, departmentNameById_(e.DepartmentID), e.Position, e.JobTitle, e.EmployeeType, e.PhoneNumber, e.Email, e.Status];
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  const tempFile = DriveApp.getFileById(tempSpreadsheet.getId());
  const excelBlob = tempFile.getAs(MimeType.MICROSOFT_EXCEL);
  const excelFile = getExportsFolder().createFile(excelBlob);
  tempFile.setTrashed(true);

  logAudit(actingUser.UserID, 'EMPLOYEE_LIST_EXPORTED', 'Employee', '*', employees.length + ' dòng');
  return { fileId: excelFile.getId(), url: excelFile.getUrl() };
}

function listEmployeesByDepartment(departmentId) {
  return listEmployees().filter(function (e) { return e.DepartmentID === departmentId; });
}

function getEmployeeById(employeeId) {
  return getSheetRepository(SHEETS.EMPLOYEES).findById('EmployeeID', employeeId);
}

// Suy ra "hồ sơ nhân viên của người đang đăng nhập" — dùng ở mọi nơi cần lọc theo sở hữu
// (listMyTasks/listMyClinicalAssignments/listMyDutyShifts) thay vì yêu cầu client tự truyền EmployeeID.
function getEmployeeByUserId_(userId) {
  return getSheetRepository(SHEETS.EMPLOYEES).findAll().find(function (e) { return e.UserID === userId; }) || null;
}

// Bản public của getEmployeeByUserId_ — client cần biết EmployeeID của chính mình (ví dụ để so sánh
// "đây có phải việc của tôi không") mà không có quyền liệt kê toàn bộ Employees để tự tra.
function getMyEmployee(user) {
  return getEmployeeByUserId_(user.UserID);
}
