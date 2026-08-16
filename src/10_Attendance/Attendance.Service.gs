// Chấm công — Giai đoạn 2. Ghi nhận trực tiếp khi còn OPEN; sau khi Chốt (LOCKED) mọi thay đổi PHẢI
// đi qua AttendanceAdjustments (requestAttendanceAdjustment...), không sửa thẳng — đúng yêu cầu
// "không cho phép sửa âm thầm dữ liệu đã chốt".

function recordAttendance(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate', 'ATTENDANCE');
  if (isBlank(input.employeeId) || isBlank(input.workDate)) {
    throw new Error('Thiếu nhân viên hoặc ngày công.');
  }
  const repo = getSheetRepository(SHEETS.ATTENDANCE);
  const duplicate = repo.findAll().find(function (a) { return a.EmployeeID === input.employeeId && a.WorkDate === input.workDate; });
  if (duplicate) throw new Error('Đã có dữ liệu chấm công cho nhân viên này vào ngày đã chọn.');

  const attendance = repo.append({
    AttendanceID: generateId('ATT'),
    EmployeeID: input.employeeId,
    DepartmentID: input.departmentId,
    WorkDate: input.workDate,
    ShiftType: input.shiftType || '',
    CheckIn: input.checkIn || '',
    CheckOut: input.checkOut || '',
    LeaveType: input.leaveType || '',
    WorkUnits: input.workUnits != null ? input.workUnits : 1,
    Status: 'OPEN',
    Notes: input.notes || '',
    RecordedByUserID: actingUser.UserID,
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_RECORDED', 'Attendance', attendance.AttendanceID, input.workDate);
  return attendance;
}

function updateAttendance(actingUser, attendanceId, patch) {
  const attendance = getSheetRepository(SHEETS.ATTENDANCE).findById('AttendanceID', attendanceId);
  if (!attendance) throw new Error('Không tìm thấy dữ liệu chấm công.');
  requirePermission(actingUser, attendance.DepartmentID, 'CanEdit', 'ATTENDANCE');
  if (attendance.Status === 'LOCKED') {
    throw new Error('Dữ liệu đã chốt — dùng chức năng Điều chỉnh công để thay đổi.');
  }
  const updated = getSheetRepository(SHEETS.ATTENDANCE).updateById('AttendanceID', attendanceId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  logAudit(actingUser.UserID, 'ATTENDANCE_UPDATED', 'Attendance', attendanceId, JSON.stringify(patch));
  return updated;
}

// Chốt hàng loạt theo khoa/phòng + khoảng ngày — chuẩn bị dữ liệu cho Tổng hợp kế toán, khoá không
// cho sửa trực tiếp nữa.
// Chốt tập trung ở Phòng TC-HC (phạm vi '*'), không giao cho từng Trưởng khoa/phòng — xem quyết định
// trong Bootstrap.Defaults.gs.
function lockAttendanceRange(actingUser, departmentId, dateFrom, dateTo) {
  requirePermission(actingUser, '*', 'CanLock', 'ATTENDANCE');
  const repo = getSheetRepository(SHEETS.ATTENDANCE);
  const rows = repo.findAll().filter(function (a) {
    return a.DepartmentID === departmentId && a.WorkDate >= dateFrom && a.WorkDate <= dateTo && a.Status === 'OPEN';
  });
  rows.forEach(function (a) { repo.updateById('AttendanceID', a.AttendanceID, { Status: 'LOCKED', UpdatedAt: nowIso() }); });
  logAudit(actingUser.UserID, 'ATTENDANCE_LOCKED', 'Department', departmentId, dateFrom + ' - ' + dateTo + ' (' + rows.length + ' dòng)');
  return { lockedCount: rows.length };
}

function listMyAttendance(user, dateFrom, dateTo) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.ATTENDANCE).findAll().filter(function (a) {
    if (a.EmployeeID !== employee.EmployeeID) return false;
    if (dateFrom && a.WorkDate < dateFrom) return false;
    if (dateTo && a.WorkDate > dateTo) return false;
    return true;
  });
}

function listAttendanceByDepartment(user, departmentId, dateFrom, dateTo) {
  requirePermission(user, departmentId, 'CanView', 'ATTENDANCE');
  return getSheetRepository(SHEETS.ATTENDANCE).findAll().filter(function (a) {
    if (a.DepartmentID !== departmentId) return false;
    if (dateFrom && a.WorkDate < dateFrom) return false;
    if (dateTo && a.WorkDate > dateTo) return false;
    return true;
  });
}

// --- Điều chỉnh công: nhân viên đề nghị -> trưởng khoa/phòng xác nhận -> Phòng TC-HC duyệt ---
// (đúng "người có thẩm quyền duyệt" trong đặc tả — Phòng TC-HC là đơn vị quản lý hồ sơ nhân sự/chấm
// công trung tâm, giống vai trò KH-NV với Lịch trực).

function requestAttendanceAdjustment(actingUser, input) {
  const attendance = getSheetRepository(SHEETS.ATTENDANCE).findById('AttendanceID', input.attendanceId);
  if (!attendance) throw new Error('Không tìm thấy dữ liệu chấm công.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isOwner = employee && attendance.EmployeeID === employee.EmployeeID;
  if (!isOwner) requirePermission(actingUser, attendance.DepartmentID, 'CanEdit', 'ATTENDANCE');
  if (isBlank(input.reason)) throw new Error('Vui lòng nhập lý do điều chỉnh.');

  const adjustment = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).append({
    AdjustmentID: generateId('ADJ'),
    AttendanceID: input.attendanceId,
    RequestedByUserID: actingUser.UserID,
    Reason: input.reason,
    OriginalCheckIn: attendance.CheckIn, OriginalCheckOut: attendance.CheckOut,
    OriginalLeaveType: attendance.LeaveType, OriginalWorkUnits: attendance.WorkUnits,
    RequestedCheckIn: input.requestedCheckIn != null ? input.requestedCheckIn : attendance.CheckIn,
    RequestedCheckOut: input.requestedCheckOut != null ? input.requestedCheckOut : attendance.CheckOut,
    RequestedLeaveType: input.requestedLeaveType != null ? input.requestedLeaveType : attendance.LeaveType,
    RequestedWorkUnits: input.requestedWorkUnits != null ? input.requestedWorkUnits : attendance.WorkUnits,
    Status: 'REQUESTED', RequestedAt: nowIso(),
    DeptHeadConfirmedByUserID: '', DeptHeadConfirmedAt: '',
    ApprovedByUserID: '', ApprovedAt: '', RejectedByUserID: '', RejectedAt: '', RejectionReason: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_ADJUSTMENT_REQUESTED', 'AttendanceAdjustment', adjustment.AdjustmentID, input.reason);
  return adjustment;
}

function confirmAttendanceAdjustmentByDeptHead(actingUser, adjustmentId) {
  const adjustment = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).findById('AdjustmentID', adjustmentId);
  if (!adjustment) throw new Error('Không tìm thấy yêu cầu điều chỉnh.');
  const attendance = getSheetRepository(SHEETS.ATTENDANCE).findById('AttendanceID', adjustment.AttendanceID);
  requirePermission(actingUser, attendance.DepartmentID, 'CanApprove', 'ATTENDANCE');
  if (adjustment.Status !== 'REQUESTED') throw new Error('Yêu cầu điều chỉnh không ở trạng thái chờ trưởng khoa xác nhận.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).updateById('AdjustmentID', adjustmentId, {
    Status: 'DEPT_HEAD_CONFIRMED', DeptHeadConfirmedByUserID: actingUser.UserID, DeptHeadConfirmedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_ADJUSTMENT_DEPTHEAD_CONFIRMED', 'AttendanceAdjustment', adjustmentId, '');
  return updated;
}

function approveAttendanceAdjustment(actingUser, adjustmentId) {
  const adjustment = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).findById('AdjustmentID', adjustmentId);
  if (!adjustment) throw new Error('Không tìm thấy yêu cầu điều chỉnh.');
  requirePermission(actingUser, '*', 'CanApprove', 'ATTENDANCE');
  if (adjustment.Status !== 'DEPT_HEAD_CONFIRMED') throw new Error('Yêu cầu điều chỉnh chưa được trưởng khoa xác nhận.');

  getSheetRepository(SHEETS.ATTENDANCE).updateById('AttendanceID', adjustment.AttendanceID, {
    CheckIn: adjustment.RequestedCheckIn, CheckOut: adjustment.RequestedCheckOut,
    LeaveType: adjustment.RequestedLeaveType, WorkUnits: adjustment.RequestedWorkUnits, UpdatedAt: nowIso()
  });
  const updated = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).updateById('AdjustmentID', adjustmentId, {
    Status: 'APPROVED', ApprovedByUserID: actingUser.UserID, ApprovedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_ADJUSTMENT_APPROVED', 'AttendanceAdjustment', adjustmentId, 'Attendance: ' + adjustment.AttendanceID);
  return updated;
}

function rejectAttendanceAdjustment(actingUser, adjustmentId, reason) {
  const adjustment = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).findById('AdjustmentID', adjustmentId);
  if (!adjustment) throw new Error('Không tìm thấy yêu cầu điều chỉnh.');
  const attendance = getSheetRepository(SHEETS.ATTENDANCE).findById('AttendanceID', adjustment.AttendanceID);
  if (['REQUESTED', 'DEPT_HEAD_CONFIRMED'].indexOf(adjustment.Status) === -1) {
    throw new Error('Yêu cầu điều chỉnh này không còn ở trạng thái có thể từ chối.');
  }
  const isDeptStage = adjustment.Status === 'REQUESTED';
  requirePermission(actingUser, isDeptStage ? attendance.DepartmentID : '*', 'CanReject', 'ATTENDANCE');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).updateById('AdjustmentID', adjustmentId, {
    Status: 'REJECTED', RejectedByUserID: actingUser.UserID, RejectedAt: nowIso(), RejectionReason: reason || '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_ADJUSTMENT_REJECTED', 'AttendanceAdjustment', adjustmentId, reason || '');
  return updated;
}

function listMyAttendanceAdjustments(user) {
  return getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).findAll().filter(function (a) { return a.RequestedByUserID === user.UserID; });
}

function listPendingAttendanceAdjustmentConfirmations(user) {
  const attendanceById_ = {};
  getSheetRepository(SHEETS.ATTENDANCE).findAll().forEach(function (a) { attendanceById_[a.AttendanceID] = a; });

  return getSheetRepository(SHEETS.ATTENDANCE_ADJUSTMENTS).findAll().filter(function (adj) {
    const attendance = attendanceById_[adj.AttendanceID];
    if (!attendance) return false;
    if (adj.Status === 'REQUESTED' && hasPermission(user, attendance.DepartmentID, 'CanApprove', 'ATTENDANCE')) return true;
    if (adj.Status === 'DEPT_HEAD_CONFIRMED' && hasPermission(user, '*', 'CanApprove', 'ATTENDANCE')) return true;
    return false;
  });
}
