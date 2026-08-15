// Làm thêm giờ / Làm ngoài giờ — Giai đoạn 2. Dùng chung 1 sheet (OvertimeType phân biệt LAM_THEM_GIO
// và LAM_NGOAI_GIO), KHÁC Lịch trực/Trực (DutyShifts) — "Trực ≠ Làm thêm giờ ≠ Làm ngoài giờ" theo
// đúng đặc tả, không gộp chung với module Lịch trực.

const OVERTIME_TYPES_ = { LAM_THEM_GIO: 'LAM_THEM_GIO', LAM_NGOAI_GIO: 'LAM_NGOAI_GIO' };

function requestOvertime(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  if (isBlank(input.employeeId) || isBlank(input.workDate) || isBlank(input.overtimeType)) {
    throw new Error('Thiếu nhân viên, ngày làm thêm hoặc loại làm thêm.');
  }
  if (OVERTIME_TYPES_[input.overtimeType] === undefined) throw new Error('Loại làm thêm không hợp lệ.');

  const overtime = getSheetRepository(SHEETS.OVERTIME).append({
    OvertimeID: generateId('OT'),
    EmployeeID: input.employeeId,
    DepartmentID: input.departmentId,
    WorkDate: input.workDate,
    StartTime: input.startTime || '',
    EndTime: input.endTime || '',
    Hours: input.hours || 0,
    OvertimeType: input.overtimeType,
    Reason: input.reason || '',
    WorkDescription: input.workDescription || '',
    Status: 'PENDING',
    ApprovedByUserID: '', ApprovedAt: '', RejectedByUserID: '', RejectedAt: '', RejectionReason: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_REQUESTED', 'Overtime', overtime.OvertimeID, input.overtimeType + ' ' + input.workDate);
  return overtime;
}

function approveOvertime(actingUser, overtimeId) {
  const overtime = getSheetRepository(SHEETS.OVERTIME).findById('OvertimeID', overtimeId);
  if (!overtime) throw new Error('Không tìm thấy đề nghị làm thêm.');
  requirePermission(actingUser, overtime.DepartmentID, 'CanApprove');
  if (overtime.Status !== 'PENDING') throw new Error('Đề nghị làm thêm không ở trạng thái chờ duyệt.');

  const updated = getSheetRepository(SHEETS.OVERTIME).updateById('OvertimeID', overtimeId, {
    Status: 'APPROVED', ApprovedByUserID: actingUser.UserID, ApprovedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_APPROVED', 'Overtime', overtimeId, '');
  return updated;
}

function rejectOvertime(actingUser, overtimeId, reason) {
  const overtime = getSheetRepository(SHEETS.OVERTIME).findById('OvertimeID', overtimeId);
  if (!overtime) throw new Error('Không tìm thấy đề nghị làm thêm.');
  requirePermission(actingUser, overtime.DepartmentID, 'CanReject');
  if (overtime.Status !== 'PENDING') throw new Error('Đề nghị làm thêm không ở trạng thái chờ duyệt.');

  const updated = getSheetRepository(SHEETS.OVERTIME).updateById('OvertimeID', overtimeId, {
    Status: 'REJECTED', RejectedByUserID: actingUser.UserID, RejectedAt: nowIso(), RejectionReason: reason || '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_REJECTED', 'Overtime', overtimeId, reason || '');
  return updated;
}

function listMyOvertime(user, dateFrom, dateTo) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.OVERTIME).findAll().filter(function (o) {
    if (o.EmployeeID !== employee.EmployeeID) return false;
    if (dateFrom && o.WorkDate < dateFrom) return false;
    if (dateTo && o.WorkDate > dateTo) return false;
    return true;
  });
}

function listOvertimeByDepartment(user, departmentId, dateFrom, dateTo) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.OVERTIME).findAll().filter(function (o) {
    if (o.DepartmentID !== departmentId) return false;
    if (dateFrom && o.WorkDate < dateFrom) return false;
    if (dateTo && o.WorkDate > dateTo) return false;
    return true;
  });
}
