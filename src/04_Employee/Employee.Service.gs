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
  seedInitialEmploymentHistory_(employee);
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

// Trang "Hồ sơ nhân viên" — tự xem hồ sơ của MÌNH luôn được phép; xem hồ sơ NGƯỜI KHÁC cần CanView
// trên khoa/phòng của họ (đúng mô hình phân quyền hiện có, không tạo nhánh quyền riêng). Trả gộp
// employee + tên khoa/phòng + tài khoản (rút gọn, không có PasswordHash/Salt) + người thân + lịch trực
// chính thức tháng hiện tại trong 1 lần gọi (đúng pattern api_getInitialAppData đã dùng cho initial
// load, tránh nhiều round-trip khi mở trang).
function getEmployeeProfileBundle(actingUser, employeeId) {
  const employee = getEmployeeById(employeeId);
  if (!employee) throw new Error('Không tìm thấy nhân viên.');
  const actingEmployee = getEmployeeByUserId_(actingUser.UserID);
  const isSelf = actingEmployee && actingEmployee.EmployeeID === employeeId;
  if (!isSelf) requirePermission(actingUser, employee.DepartmentID, 'CanView');

  let canEdit = isSelf;
  if (!canEdit) {
    try { requireEmployeeManager_(actingUser); canEdit = true; } catch (e) { canEdit = false; }
  }

  const department = getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', employee.DepartmentID);
  const userAccount = getSheetRepository(SHEETS.USERS).findById('UserID', employee.UserID);
  const account = userAccount ? {
    Username: userAccount.Username, Email: userAccount.Email, Role: userAccount.Role,
    Status: userAccount.Status, AvatarUrl: userAccount.AvatarUrl
  } : null;

  const today = new Date();
  const monthStart = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth(), 1), HANOI_TZ_, 'yyyy-MM-dd');
  const monthEnd = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0), HANOI_TZ_, 'yyyy-MM-dd');
  const dutyShiftsThisMonth = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) {
    return s.EmployeeID === employeeId && s.Status === 'OFFICIAL' && s.ShiftDate >= monthStart && s.ShiftDate <= monthEnd;
  });

  return {
    employee: employee, departmentName: department ? department.DepartmentName : '',
    account: account, canEdit: canEdit,
    familyMembers: listFamilyMembers(employeeId),
    dutyShiftsThisMonth: dutyShiftsThisMonth,
    employmentHistory: listEmploymentHistory(employeeId),
    qualifications: listQualifications(employeeId),
    assignments: listEmployeeAssignments(employeeId)
  };
}

// Danh sách trường "Thông tin cá nhân" mà CHÍNH nhân viên được tự sửa (không gồm các trường nghiệp vụ
// như Position/DepartmentID/Status/EmployeeCode — những trường đó vẫn chỉ requireEmployeeManager_ qua
// updateEmployee, đúng nguyên tắc "không để nhân viên tự ý điều chỉnh dữ liệu tổ chức").
const EMPLOYEE_SELF_EDITABLE_FIELDS_ = [
  'PhoneNumber', 'PreferredName', 'DateOfBirth', 'Gender', 'MaritalStatus', 'Nationality', 'Ethnicity',
  'IdNumber', 'IdIssueDate', 'IdIssuePlace', 'Hometown', 'PermanentAddress', 'ContactAddress',
  'BloodType', 'HeightCm', 'WeightKg'
];

function updateMyPersonalInfo(actingUser, patch) {
  const employee = getEmployeeByUserId_(actingUser.UserID);
  if (!employee) throw new Error('Bạn chưa có hồ sơ nhân viên.');
  const safePatch = {};
  EMPLOYEE_SELF_EDITABLE_FIELDS_.forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) safePatch[field] = patch[field];
  });
  const updated = getSheetRepository(SHEETS.EMPLOYEES).updateById('EmployeeID', employee.EmployeeID, Object.assign({}, safePatch, { UpdatedAt: nowIso() }));
  logAudit(actingUser.UserID, 'EMPLOYEE_SELF_UPDATED', 'Employee', employee.EmployeeID, JSON.stringify(safePatch));
  return updated;
}

function requireFamilyMemberManager_(actingUser, employeeId) {
  const actingEmployee = getEmployeeByUserId_(actingUser.UserID);
  if (actingEmployee && actingEmployee.EmployeeID === employeeId) return;
  requireEmployeeManager_(actingUser);
}

function listFamilyMembers(employeeId) {
  return getSheetRepository(SHEETS.EMPLOYEE_FAMILY_MEMBERS).findAll().filter(function (m) { return m.EmployeeID === employeeId; });
}

function addFamilyMember(actingUser, employeeId, input) {
  requireFamilyMemberManager_(actingUser, employeeId);
  if (isBlank(input.fullName)) throw new Error('Thiếu họ tên người thân.');
  const member = getSheetRepository(SHEETS.EMPLOYEE_FAMILY_MEMBERS).append({
    FamilyMemberID: generateId('FAM'), EmployeeID: employeeId,
    Relationship: input.relationship || '', FullName: input.fullName,
    PhoneNumber: input.phoneNumber || '', BirthYear: input.birthYear || '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'FAMILY_MEMBER_ADDED', 'Employee', employeeId, input.fullName);
  return member;
}

function removeFamilyMember(actingUser, familyMemberId) {
  const member = getSheetRepository(SHEETS.EMPLOYEE_FAMILY_MEMBERS).findById('FamilyMemberID', familyMemberId);
  if (!member) throw new Error('Không tìm thấy người thân.');
  requireFamilyMemberManager_(actingUser, member.EmployeeID);

  const ss = getSystemSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEE_FAMILY_MEMBERS);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('FamilyMemberID');
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][idIdx] === familyMemberId) { sheet.deleteRow(r + 1); break; }
  }
  logAudit(actingUser.UserID, 'FAMILY_MEMBER_REMOVED', 'Employee', member.EmployeeID, member.FullName);
  return { success: true };
}

// --- "Quá trình công tác" (đặc tả Tái cấu trúc Nhân sự V1 §8) ---

function seedInitialEmploymentHistory_(employee) {
  getSheetRepository(SHEETS.EMPLOYMENT_HISTORY).append({
    HistoryID: generateId('EMH'), EmployeeID: employee.EmployeeID, DepartmentID: employee.DepartmentID,
    Position: employee.Position || '', JobTitle: employee.JobTitle || '',
    StartDate: employee.StartDate || nowIso().slice(0, 10), EndDate: '',
    Note: '', CreatedByUserID: employee.UserID, CreatedAt: nowIso()
  });
}

// Dữ liệu nhân sự có TRƯỚC khi module Quá trình công tác ra đời sẽ chưa có dòng lịch sử nào — backfill
// LƯỜI (lazy) 1 dòng từ chính hồ sơ hiện tại ngay lần đầu được xem, cùng cách tiếp cận đã dùng cho
// Recurring Task Instance (Task.Service.gs#ensureRecurringInstancesForEmployee_) — không cần trigger
// hay migration script riêng.
function listEmploymentHistory(employeeId) {
  const repo = getSheetRepository(SHEETS.EMPLOYMENT_HISTORY);
  let history = repo.findAll().filter(function (h) { return h.EmployeeID === employeeId; });
  if (history.length === 0) {
    const employee = getEmployeeById(employeeId);
    if (employee) {
      seedInitialEmploymentHistory_(employee);
      history = repo.findAll().filter(function (h) { return h.EmployeeID === employeeId; });
    }
  }
  return history.sort(function (a, b) { return a.StartDate < b.StartDate ? 1 : -1; });
}

// "Chuyển đơn vị/chức danh/chức vụ" — hành động TỔ CHỨC (không phải sửa hồ sơ cá nhân), khác
// updateMyPersonalInfo/updateEmployee ở chỗ tự động khép dòng Quá trình công tác đang hiệu lực + mở 1
// dòng mới, đúng §8 "biết nhân sự từng thuộc đơn vị nào, biết thay đổi chức danh/chức vụ".
function changeEmployeeAssignment(actingUser, employeeId, input) {
  requireEmployeeManager_(actingUser);
  const employee = getEmployeeById(employeeId);
  if (!employee) throw new Error('Không tìm thấy nhân viên.');
  if (isBlank(input.effectiveDate)) throw new Error('Thiếu ngày hiệu lực.');
  const department = getSheetRepository(SHEETS.DEPARTMENTS).findById('DepartmentID', input.departmentId || employee.DepartmentID);
  if (!department) throw new Error('Khoa/Phòng không tồn tại.');

  // Đảm bảo LUÔN có ít nhất 1 dòng lịch sử trước khi chuyển — nhân sự tạo trước khi có module này, hoặc
  // chưa từng mở tab "Quá trình công tác" (nơi mới lazy-backfill), sẽ không có dòng nào để khép, làm
  // mất mốc "trước khi chuyển" khỏi lịch sử nếu bỏ qua bước này.
  listEmploymentHistory(employeeId);
  const historyRepo = getSheetRepository(SHEETS.EMPLOYMENT_HISTORY);
  const openEntry = historyRepo.findAll().find(function (h) { return h.EmployeeID === employeeId && isBlank(h.EndDate); });
  if (openEntry) {
    historyRepo.updateById('HistoryID', openEntry.HistoryID, { EndDate: addDaysToDateString_(input.effectiveDate, -1) });
  }
  historyRepo.append({
    HistoryID: generateId('EMH'), EmployeeID: employeeId, DepartmentID: department.DepartmentID,
    Position: input.position != null ? input.position : employee.Position,
    JobTitle: input.jobTitle != null ? input.jobTitle : employee.JobTitle,
    StartDate: input.effectiveDate, EndDate: '', Note: input.note || '',
    CreatedByUserID: actingUser.UserID, CreatedAt: nowIso()
  });

  const updated = getSheetRepository(SHEETS.EMPLOYEES).updateById('EmployeeID', employeeId, {
    DepartmentID: department.DepartmentID,
    Position: input.position != null ? input.position : employee.Position,
    JobTitle: input.jobTitle != null ? input.jobTitle : employee.JobTitle,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'EMPLOYEE_ASSIGNMENT_CHANGED', 'Employee', employeeId, JSON.stringify(input));
  return updated;
}

// --- "Bằng cấp & Chứng chỉ" (đặc tả Tái cấu trúc Nhân sự V1 §9) — V1 chỉ CRUD dữ liệu hồ sơ cơ bản,
// KHÔNG xây cảnh báo hết hạn (đúng §18 "chưa làm ở V1"). ---

function listQualifications(employeeId) {
  return getSheetRepository(SHEETS.QUALIFICATIONS).findAll().filter(function (q) { return q.EmployeeID === employeeId; });
}

function addQualification(actingUser, employeeId, input) {
  requireFamilyMemberManager_(actingUser, employeeId);
  if (isBlank(input.name)) throw new Error('Thiếu tên bằng cấp/chứng chỉ.');
  const qualification = getSheetRepository(SHEETS.QUALIFICATIONS).append({
    QualificationID: generateId('QUAL'), EmployeeID: employeeId,
    Type: input.type || '', Name: input.name, IssueDate: input.issueDate || '', ExpiryDate: input.expiryDate || '',
    IssuingOrg: input.issuingOrg || '', EvidenceNote: input.evidenceNote || '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'QUALIFICATION_ADDED', 'Employee', employeeId, input.name);
  return qualification;
}

function removeQualification(actingUser, qualificationId) {
  const qualification = getSheetRepository(SHEETS.QUALIFICATIONS).findById('QualificationID', qualificationId);
  if (!qualification) throw new Error('Không tìm thấy bằng cấp/chứng chỉ.');
  requireFamilyMemberManager_(actingUser, qualification.EmployeeID);

  const sheet = getSystemSpreadsheet_().getSheetByName(SHEETS.QUALIFICATIONS);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('QualificationID');
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][idIdx] === qualificationId) { sheet.deleteRow(r + 1); break; }
  }
  logAudit(actingUser.UserID, 'QUALIFICATION_REMOVED', 'Employee', qualification.EmployeeID, qualification.Name);
  return { success: true };
}

// --- "Phân công nhân sự" (đặc tả Tái cấu trúc Nhân sự V1 §15) — CỐ Ý KHÔNG dùng chung logic với
// Permissions (phân quyền hệ thống) hay RecordOwnerUserID (phụ trách hồ sơ). Chỉ requireEmployeeManager_
// được tạo/kết thúc phân công — đây là quyết định tổ chức, không phải tự khai. ---

function listEmployeeAssignments(employeeId) {
  return getSheetRepository(SHEETS.EMPLOYEE_ASSIGNMENTS).findAll().filter(function (a) { return a.EmployeeID === employeeId; });
}

function addEmployeeAssignment(actingUser, employeeId, input) {
  requireEmployeeManager_(actingUser);
  if (isBlank(input.assignmentText)) throw new Error('Thiếu nội dung phân công.');
  const employee = getEmployeeById(employeeId);
  if (!employee) throw new Error('Không tìm thấy nhân viên.');
  const assignment = getSheetRepository(SHEETS.EMPLOYEE_ASSIGNMENTS).append({
    AssignmentID: generateId('ASGN'), EmployeeID: employeeId, AssignmentText: input.assignmentText,
    StartDate: input.startDate || nowIso().slice(0, 10), EndDate: '',
    CreatedByUserID: actingUser.UserID, CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'EMPLOYEE_ASSIGNMENT_ADDED', 'Employee', employeeId, input.assignmentText);
  return assignment;
}

function endEmployeeAssignment(actingUser, assignmentId) {
  requireEmployeeManager_(actingUser);
  const updated = getSheetRepository(SHEETS.EMPLOYEE_ASSIGNMENTS).updateById('AssignmentID', assignmentId, {
    EndDate: nowIso().slice(0, 10), UpdatedAt: nowIso()
  });
  if (!updated) throw new Error('Không tìm thấy phân công.');
  logAudit(actingUser.UserID, 'EMPLOYEE_ASSIGNMENT_ENDED', 'Employee', updated.EmployeeID, updated.AssignmentText);
  return updated;
}
