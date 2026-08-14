// Hàm chẩn đoán chỉ dùng nội bộ khi phát triển (gọi qua `clasp run`, không expose qua Core.Api.gs
// cho client) — đọc dữ liệu thô để kiểm tra nhanh, không có tác dụng phụ.

function diagListDepartments() {
  return getSheetRepository(SHEETS.DEPARTMENTS).findAll();
}

function diagListEmployees() {
  return getSheetRepository(SHEETS.EMPLOYEES).findAll();
}

function diagListTasks() {
  return getSheetRepository(SHEETS.TASKS).findAll();
}

function diagListDutySchedules() {
  return getSheetRepository(SHEETS.DUTY_SCHEDULES).findAll();
}

function diagListDutyShifts() {
  return getSheetRepository(SHEETS.DUTY_SHIFTS).findAll();
}

function diagListSwapRequests() {
  return getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findAll();
}

function diagListUsers() {
  return getSheetRepository(SHEETS.USERS).findAll();
}

function diagListPermissions() {
  return getSheetRepository(SHEETS.PERMISSIONS).findAll();
}

function diagListAuditLog() {
  return getSheetRepository(SHEETS.AUDIT_LOG).findAll();
}

// --- Auth Gateway (Auth.Password.gs / Auth.Token.gs / Auth.Gateway.gs) ---

function diagHashPassword(plainPassword) {
  return hashPassword_(plainPassword);
}

function diagVerifyPassword(plainPassword, hashBase64, salt) {
  return verifyPassword_(plainPassword, hashBase64, salt);
}

function diagIssueTokenForUser(userId) {
  const user = getSheetRepository(SHEETS.USERS).findById('UserID', userId);
  if (!user) return { error: 'USER_NOT_FOUND' };
  return issueAccessToken_(user);
}

function diagVerifyToken(token) {
  return verifyAccessToken_(token);
}

function diagRevokeToken(token) {
  revokeToken_(token);
  return { done: true };
}

// Smoke test toàn bộ luồng: đặt mật khẩu tạm cho 1 nhân viên có sẵn EmployeeCode, đăng nhập qua
// Gateway, xác thực token, thu hồi, xác nhận token bị từ chối sau khi thu hồi.
function diagRunAuthGatewayLifecycle(employeeId, tempPassword) {
  const employee = getSheetRepository(SHEETS.EMPLOYEES).findById('EmployeeID', employeeId);
  if (!employee) return { error: 'EMPLOYEE_NOT_FOUND' };
  if (isBlank(employee.EmployeeCode)) return { error: 'EMPLOYEE_HAS_NO_CODE' };

  const hashed = hashPassword_(tempPassword);
  getSheetRepository(SHEETS.USERS).updateById('UserID', employee.UserID, { PasswordHash: hashed.hash, PasswordSalt: hashed.salt });

  const loginResult = authenticateWithPassword(employee.EmployeeCode, tempPassword);
  const verifiedUser = verifyAccessToken_(loginResult.token);
  revokeToken_(loginResult.token);

  let revokedRejected = false;
  try {
    verifyAccessToken_(loginResult.token);
  } catch (e) {
    revokedRejected = true;
  }

  return {
    loginSucceeded: !!loginResult.token,
    verifiedUserId: verifiedUser.UserID,
    matchesEmployeeUser: verifiedUser.UserID === employee.UserID,
    revokedTokenRejected: revokedRejected
  };
}

function diagFileInfo(fileId) {
  const file = DriveApp.getFileById(fileId);
  return { name: file.getName(), size: file.getSize(), mimeType: file.getMimeType(), isTrashed: file.isTrashed() };
}

function diagMailQuota() {
  return MailApp.getRemainingDailyQuota();
}

// Smoke test toàn bộ vòng đời Lịch trực tuần trên dữ liệu CÔ LẬP (tự tạo nhân viên/lịch/ca trực
// riêng, không đụng dữ liệu thật) — chạy 1 lần qua `clasp run diagRunDutyScheduleLifecycle` để xác
// nhận DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PUBLISHED + 1 luồng đổi trực hoạt động đúng
// đầu-cuối mà không cần bấm tay qua UI. actingUser truyền vào phải có quyền phù hợp ở departmentId
// (thường dùng tài khoản SUPER_ADMIN khi test vì SUPER_ADMIN bỏ qua mọi kiểm tra quyền).
function diagRunDutyScheduleLifecycle(departmentId) {
  const user = getCurrentUser();
  const employees = listEmployeesByDepartment(departmentId).filter(function (e) { return e.Status === 'Active'; });
  if (employees.length < 2) {
    return { error: 'Cần ít nhất 2 nhân viên Active trong khoa/phòng này để test đổi trực.' };
  }

  const weekStart = '2026-08-17';
  const weekEnd = '2026-08-23';
  const schedule = createDutySchedule(user, departmentId, weekStart, weekEnd);
  const shift = addDutyShift(user, schedule.DutyScheduleID, {
    shiftDate: '2026-08-17', dutyType: 'Trực thường', employeeId: employees[0].EmployeeID,
    roleInShift: 'Trực chính', shiftStart: '18:00', shiftEnd: '06:00', notes: 'Smoke test'
  });

  submitDutySchedule(user, schedule.DutyScheduleID);
  markDutyScheduleUnderReview(user, schedule.DutyScheduleID);
  approveDutySchedule(user, schedule.DutyScheduleID, 'OK');
  publishDutySchedule(user, schedule.DutyScheduleID);

  const swapRequest = requestSwap(user, { originalShiftId: shift.DutyShiftID, replacementEmployeeId: employees[1].EmployeeID, reason: 'Smoke test' });
  confirmSwapByReplacement(user, swapRequest.SwapRequestID);
  confirmSwapByDeptHead(user, swapRequest.SwapRequestID);
  const approvedSwap = approveSwapByKhNv(user, swapRequest.SwapRequestID);

  return {
    dutyScheduleId: schedule.DutyScheduleID,
    finalScheduleStatus: getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', schedule.DutyScheduleID).Status,
    originalShiftId: shift.DutyShiftID,
    newShiftId: approvedSwap.NewShiftID,
    swapRequestStatus: approvedSwap.Status
  };
}
