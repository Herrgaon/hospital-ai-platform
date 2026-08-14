// Hồ sơ nhân viên trung tâm — 1 nhân viên = 1 bản ghi Employees, tham chiếu qua EmployeeID từ mọi
// module khác (Task/ClinicalAssignment/DutySchedule). Danh tính đăng nhập vẫn thuộc Users (UserID),
// không lặp lại quản lý định danh — dùng lại createUser (Admin.UserManagement.gs) để get-or-create
// bản ghi Users trước khi tạo Employees.

function requireEmployeeManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_TC_HC) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Tổ chức – Hành chính được quản lý hồ sơ nhân viên.');
  }
}

function findOrCreateUserForEmployee_(actingUser, email, fullName, departmentName) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = getSheetRepository(SHEETS.USERS).findAll().find(function (u) { return u.Email.toLowerCase() === normalizedEmail; });
  if (existing) return existing;
  return createUser(actingUser, normalizedEmail, fullName, ROLE_NAMES.NHAN_VIEN, departmentName || '');
}

function createEmployee(actingUser, input) {
  requireEmployeeManager_(actingUser);
  if (isBlank(input.email) || isBlank(input.fullName) || isBlank(input.departmentId) || isBlank(input.employeeCode)) {
    throw new Error('Thiếu thông tin bắt buộc: mã nhân viên, email, họ tên hoặc khoa/phòng.');
  }
  const department = getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', input.departmentId);
  if (!department) throw new Error('Khoa/Phòng không tồn tại.');

  const employeesRepo = getSheetRepository(SHEETS.EMPLOYEES);
  const duplicateCode = employeesRepo.findAll().find(function (e) { return e.EmployeeCode === input.employeeCode; });
  if (duplicateCode) throw new Error('Mã nhân viên "' + input.employeeCode + '" đã được sử dụng.');

  const user = findOrCreateUserForEmployee_(actingUser, input.email, input.fullName, department.DepartmentName);
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
    EmployeeType: input.employeeType || '',
    PhoneNumber: input.phoneNumber || '',
    Email: user.Email,
    StartDate: input.startDate || '',
    Status: 'Active',
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
  logAudit(actingUser.UserID, 'EMPLOYEE_DEACTIVATED', 'Employee', employeeId, employee.FullName);
  return { success: true };
}

function listEmployees() {
  return getSheetRepository(SHEETS.EMPLOYEES).findAll();
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
