// Quy trình Kỳ chấm công hàng tháng — đúng Đặc tả Chấm công & Tiền lương V1 §3-4:
// DRAFT (Nhập) -> DEPT_COMPLETED (Khoa hoàn thiện) -> DEPT_HEAD_CONFIRMED (Trưởng khoa xác nhận) ->
// SUBMITTED (Đã gửi) -> UNDER_REVIEW (Đang kiểm tra) -> LOCKED (Đã chốt), có thể trả về DRAFT
// (RevisionRequested) từ SUBMITTED/UNDER_REVIEW nếu phát hiện sai sót trước khi chốt, và có luồng
// "Đề nghị mở lại" riêng sau khi đã LOCKED (xem AttendancePeriodReopenRequests bên dưới).

const ATTENDANCE_PERIOD_EDITABLE_STATUSES_ = ['DRAFT', 'DEPT_COMPLETED'];

function getAttendancePeriodOrThrow_(periodId) {
  const period = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).findById('AttendancePeriodID', periodId);
  if (!period) throw new Error('Không tìm thấy kỳ chấm công.');
  return period;
}

// "Ngày cuối tháng" tính an toàn qua Date(năm, tháng+1, ngày 0) — không phụ thuộc năm nhuận/số ngày
// từng tháng phải tự liệt kê.
function lastDayOfMonth_(periodMonth) {
  const parts = periodMonth.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
}

// Đúng §3 "hệ thống tự đưa vào nhân sự thuộc đơn vị + lịch trực đã phê duyệt", MỤC TIÊU khoa/phòng chủ
// yếu KIỂM TRA VÀ XÁC NHẬN, không nhập lại toàn bộ. Không tự đưa "Nghỉ đã phê duyệt" (chưa có khái
// niệm đơn xin nghỉ/duyệt nghỉ riêng trong hệ thống — LeaveType vẫn để khoa tự nhập tay ở bước Nhập,
// đây là đơn giản hoá CÓ CHỦ ĐÍCH cho V1, không phải thiếu sót). Idempotent — dòng công đã có sẵn
// (từ Ghi nhận công thủ công trước đây) được GẮN vào kỳ thay vì tạo trùng, chặn báo lỗi trùng ngày.
function createAttendancePeriod(actingUser, departmentId, periodMonth) {
  requirePermission(actingUser, departmentId, 'CanCreate', 'ATTENDANCE');
  if (isBlank(departmentId) || isBlank(periodMonth) || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new Error('Thiếu khoa/phòng hoặc kỳ chấm công không hợp lệ (định dạng YYYY-MM).');
  }
  const periodsRepo = getSheetRepository(SHEETS.ATTENDANCE_PERIODS);
  const duplicate = periodsRepo.findAll().find(function (p) { return p.DepartmentID === departmentId && p.PeriodMonth === periodMonth; });
  if (duplicate) throw new Error('Kỳ chấm công tháng ' + periodMonth + ' của khoa/phòng này đã tồn tại.');

  const period = periodsRepo.append({
    AttendancePeriodID: generateId('ATP'), DepartmentID: departmentId, PeriodMonth: periodMonth, Status: 'DRAFT',
    CreatedByUserID: actingUser.UserID, CreatedAt: nowIso(),
    DeptCompletedByUserID: '', DeptCompletedAt: '', DeptHeadConfirmedByUserID: '', DeptHeadConfirmedAt: '',
    SubmittedAt: '', ReviewedByUserID: '', ReviewedAt: '', ReviewComment: '', LockedByUserID: '', LockedAt: '',
    UpdatedAt: nowIso()
  });

  const employees = listEmployeesByDepartment(departmentId).filter(function (e) { return e.Status === 'Active'; });
  const dayCount = lastDayOfMonth_(periodMonth);
  const attendanceRepo = getSheetRepository(SHEETS.ATTENDANCE);
  const existing = attendanceRepo.findAll();
  const officialShifts = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) { return s.Status === 'OFFICIAL'; });

  let generatedCount = 0;
  employees.forEach(function (employee) {
    for (let day = 1; day <= dayCount; day++) {
      const workDate = periodMonth + '-' + String(day).padStart(2, '0');
      const existingRow = existing.find(function (a) { return a.EmployeeID === employee.EmployeeID && a.WorkDate === workDate; });
      if (existingRow) {
        if (isBlank(existingRow.AttendancePeriodID)) {
          attendanceRepo.updateById('AttendanceID', existingRow.AttendanceID, { AttendancePeriodID: period.AttendancePeriodID, UpdatedAt: nowIso() });
        }
        continue;
      }
      const matchingShift = officialShifts.find(function (s) { return s.EmployeeID === employee.EmployeeID && s.ShiftDate === workDate; });
      attendanceRepo.append({
        AttendanceID: generateId('ATT'), EmployeeID: employee.EmployeeID, DepartmentID: departmentId, WorkDate: workDate,
        ShiftType: matchingShift ? matchingShift.DutyType : '', CheckIn: '', CheckOut: '', LeaveType: '',
        WorkUnits: 1, Status: 'OPEN', Notes: '', AttendancePeriodID: period.AttendancePeriodID,
        RecordedByUserID: actingUser.UserID, CreatedAt: nowIso(), UpdatedAt: nowIso()
      });
      generatedCount++;
    }
  });

  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_CREATED', 'AttendancePeriod', period.AttendancePeriodID,
    periodMonth + ' — ' + employees.length + ' nhân sự, ' + generatedCount + ' dòng công mới');
  return period;
}

function markAttendancePeriodDeptCompleted(actingUser, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, period.DepartmentID, 'CanEdit', 'ATTENDANCE');
  if (period.Status !== 'DRAFT') throw new Error('Chỉ có thể đánh dấu hoàn thiện kỳ chấm công đang ở trạng thái Nhập.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'DEPT_COMPLETED', DeptCompletedByUserID: actingUser.UserID, DeptCompletedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_DEPT_COMPLETED', 'AttendancePeriod', periodId, period.PeriodMonth);
  return updated;
}

function confirmAttendancePeriodByDeptHead(actingUser, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, period.DepartmentID, 'CanApprove', 'ATTENDANCE');
  if (period.Status !== 'DEPT_COMPLETED') throw new Error('Chỉ có thể xác nhận kỳ chấm công đã được khoa hoàn thiện.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'DEPT_HEAD_CONFIRMED', DeptHeadConfirmedByUserID: actingUser.UserID, DeptHeadConfirmedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_DEPTHEAD_CONFIRMED', 'AttendancePeriod', periodId, period.PeriodMonth);
  return updated;
}

function submitAttendancePeriod(actingUser, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, period.DepartmentID, 'CanSubmit', 'ATTENDANCE');
  if (period.Status !== 'DEPT_HEAD_CONFIRMED') throw new Error('Chỉ có thể gửi kỳ chấm công đã được Trưởng khoa xác nhận.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'SUBMITTED', SubmittedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_SUBMITTED', 'AttendancePeriod', periodId, period.PeriodMonth);
  notifyApprovers(actingUser, period.DepartmentID, 'Chấm công tháng ' + period.PeriodMonth + ' cần kiểm tra',
    'Khoa/Phòng: ' + period.DepartmentID + '\nKỳ: ' + period.PeriodMonth, 'ATTENDANCE');
  return updated;
}

function markAttendancePeriodUnderReview(actingUser, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, '*', 'CanApprove', 'ATTENDANCE');
  if (period.Status !== 'SUBMITTED') throw new Error('Chỉ có thể bắt đầu kiểm tra kỳ chấm công đang ở trạng thái Đã gửi.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'UNDER_REVIEW', ReviewedByUserID: actingUser.UserID, ReviewedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_REVIEW_STARTED', 'AttendancePeriod', periodId, period.PeriodMonth);
  return updated;
}

// Đúng §4 "Nếu sai → Đề nghị mở lại..." áp dụng NGAY CẢ trước khi chốt — đơn vị phụ trách phát hiện
// sai sót lúc kiểm tra thì trả thẳng về Nhập, không cần đi qua luồng Đề nghị mở lại (vốn dành cho SAU
// KHI đã LOCKED).
function requestAttendancePeriodRevision(actingUser, periodId, comment) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, '*', 'CanReject', 'ATTENDANCE');
  if (['SUBMITTED', 'UNDER_REVIEW'].indexOf(period.Status) === -1) {
    throw new Error('Chỉ có thể yêu cầu chỉnh sửa kỳ chấm công đang chờ kiểm tra.');
  }

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'DRAFT', ReviewComment: comment || '', ReviewedByUserID: actingUser.UserID, ReviewedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_REVISION_REQUESTED', 'AttendancePeriod', periodId, comment || '');
  notifyUser(period.CreatedByUserID, 'Chấm công tháng ' + period.PeriodMonth + ' cần chỉnh sửa', comment || '');
  return updated;
}

function lockAttendancePeriod(actingUser, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(actingUser, '*', 'CanLock', 'ATTENDANCE');
  if (period.Status !== 'UNDER_REVIEW') throw new Error('Chỉ có thể chốt kỳ chấm công đang ở trạng thái Đang kiểm tra.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', periodId, {
    Status: 'LOCKED', LockedByUserID: actingUser.UserID, LockedAt: nowIso(), UpdatedAt: nowIso()
  });
  const attendanceRepo = getSheetRepository(SHEETS.ATTENDANCE);
  const rows = attendanceRepo.findAll().filter(function (a) { return a.AttendancePeriodID === periodId; });
  rows.forEach(function (a) { attendanceRepo.updateById('AttendanceID', a.AttendanceID, { Status: 'LOCKED', UpdatedAt: nowIso() }); });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_LOCKED', 'AttendancePeriod', periodId, period.PeriodMonth + ' (' + rows.length + ' dòng công)');
  return updated;
}

function listAttendancePeriodsByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView', 'ATTENDANCE');
  return getSheetRepository(SHEETS.ATTENDANCE_PERIODS).findAll().filter(function (p) { return p.DepartmentID === departmentId; })
    .sort(function (a, b) { return a.PeriodMonth < b.PeriodMonth ? 1 : -1; });
}

function getAttendancePeriodDetail(user, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(user, period.DepartmentID, 'CanView', 'ATTENDANCE');
  const rows = getSheetRepository(SHEETS.ATTENDANCE).findAll().filter(function (a) { return a.AttendancePeriodID === periodId; })
    .sort(function (a, b) { return a.WorkDate < b.WorkDate ? -1 : 1; });
  return { period: period, rows: rows };
}

// Đúng §5 "Dashboard chấm công toàn viện" — trạng thái kỳ THÁNG HIỆN TẠI của từng khoa/phòng đang hoạt
// động. Không có kỳ nào cho tháng hiện tại = "Chưa gửi" (đỏ) dù trước đó có kỳ tháng khác đã chốt.
function getAttendanceDashboard(actingUser) {
  requirePermission(actingUser, '*', 'CanView', 'ATTENDANCE');
  const currentMonth = Utilities.formatDate(new Date(), HANOI_TZ_, 'yyyy-MM');
  const departments = getSheetRepository(SHEETS.DEPARTMENTS).findAll().filter(function (d) { return d.Status === 'Active'; });
  const periods = getSheetRepository(SHEETS.ATTENDANCE_PERIODS).findAll().filter(function (p) { return p.PeriodMonth === currentMonth; });

  const rows = departments.map(function (dept) {
    const period = periods.find(function (p) { return p.DepartmentID === dept.DepartmentID; });
    let statusLabel = 'NOT_STARTED';
    if (period) {
      if (period.Status === 'LOCKED') statusLabel = 'LOCKED';
      else if (['DEPT_HEAD_CONFIRMED', 'SUBMITTED', 'UNDER_REVIEW'].indexOf(period.Status) !== -1) statusLabel = 'SUBMITTED';
      else statusLabel = 'NEEDS_INPUT';
    }
    return { departmentId: dept.DepartmentID, departmentName: dept.DepartmentName, period: period || null, statusLabel: statusLabel };
  });

  return {
    currentMonth: currentMonth, departments: rows,
    summary: {
      total: rows.length,
      submitted: rows.filter(function (r) { return r.statusLabel === 'SUBMITTED'; }).length,
      needsInput: rows.filter(function (r) { return r.statusLabel === 'NEEDS_INPUT'; }).length,
      notStarted: rows.filter(function (r) { return r.statusLabel === 'NOT_STARTED'; }).length,
      locked: rows.filter(function (r) { return r.statusLabel === 'LOCKED'; }).length
    }
  };
}

// Đúng §6 "Đối chiếu" — CHỈ CẢNH BÁO, KHÔNG BAO GIỜ tự kết luận vi phạm. Đối chiếu với Lịch trực (ca
// OFFICIAL đúng ngày), Đổi trực (ca gốc có bị đổi đi không — nếu SWAPPED_OUT thì công ngày đó không
// nên tính theo ca cũ), Làm ngoài giờ (đã có trong 1 OvertimeList đã FINALIZED đúng ngày). Máy chấm
// công: CHƯA tích hợp (Giai đoạn 6) — luôn trả "Chưa có dữ liệu", không suy đoán.
function getAttendancePeriodReconciliation(user, periodId) {
  const period = getAttendancePeriodOrThrow_(periodId);
  requirePermission(user, period.DepartmentID, 'CanView', 'ATTENDANCE');

  const rows = getSheetRepository(SHEETS.ATTENDANCE).findAll().filter(function (a) { return a.AttendancePeriodID === periodId; });
  const officialShifts = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) { return s.Status === 'OFFICIAL'; });
  const swappedOutShifts = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) { return s.Status === 'SWAPPED_OUT'; });
  const finalizedOvertimeListIds = getSheetRepository(SHEETS.OVERTIME_LISTS).findAll()
    .filter(function (l) { return l.Status === 'FINALIZED'; }).map(function (l) { return l.OvertimeListID; });
  const overtimeItems = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).findAll()
    .filter(function (item) { return finalizedOvertimeListIds.indexOf(item.OvertimeListID) !== -1; });

  return rows.map(function (a) {
    const hasOfficialShift = officialShifts.some(function (s) { return s.EmployeeID === a.EmployeeID && s.ShiftDate === a.WorkDate; });
    const hasSwappedOutShift = swappedOutShifts.some(function (s) { return s.EmployeeID === a.EmployeeID && s.ShiftDate === a.WorkDate; });
    const hasFinalizedOvertime = overtimeItems.some(function (item) { return item.EmployeeID === a.EmployeeID && item.WorkDate === a.WorkDate; });
    const warnings = [];
    if (hasOfficialShift && isBlank(a.ShiftType) && isBlank(a.LeaveType)) warnings.push('Có lịch trực chính thức nhưng chưa ghi nhận công tương ứng.');
    if (!hasOfficialShift && !isBlank(a.ShiftType) && isBlank(a.LeaveType)) warnings.push('Ghi nhận có ca trực nhưng không khớp lịch trực chính thức — cần xác minh.');
    if (hasSwappedOutShift) warnings.push('Ca trực gốc ngày này đã được đổi cho người khác — kiểm tra lại công ghi nhận.');

    return {
      attendanceId: a.AttendanceID, employeeId: a.EmployeeID, workDate: a.WorkDate,
      hasOfficialShift: hasOfficialShift, hasSwappedOutShift: hasSwappedOutShift,
      hasFinalizedOvertime: hasFinalizedOvertime, hasDeviceData: false,
      warnings: warnings
    };
  });
}

// --- "Đề nghị mở lại" kỳ chấm công ĐÃ CHỐT (đúng §4) ---

function requestReopenAttendancePeriod(actingUser, periodId, reason) {
  const period = getAttendancePeriodOrThrow_(periodId);
  if (period.Status !== 'LOCKED') throw new Error('Chỉ có thể đề nghị mở lại kỳ chấm công đã chốt.');
  requirePermission(actingUser, period.DepartmentID, 'CanEdit', 'ATTENDANCE');
  if (isBlank(reason)) throw new Error('Vui lòng nêu lý do đề nghị mở lại.');

  const request = getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).append({
    ReopenRequestID: generateId('ARR'), AttendancePeriodID: periodId, RequestedByUserID: actingUser.UserID, Reason: reason,
    Status: 'REQUESTED', RequestedAt: nowIso(),
    ApprovedByUserID: '', ApprovedAt: '', RejectedByUserID: '', RejectedAt: '', RejectionReason: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_REOPEN_REQUESTED', 'AttendancePeriod', periodId, reason);
  return request;
}

function approveReopenAttendancePeriod(actingUser, requestId) {
  const request = getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).findById('ReopenRequestID', requestId);
  if (!request) throw new Error('Không tìm thấy đề nghị mở lại.');
  requirePermission(actingUser, '*', 'CanLock', 'ATTENDANCE');
  if (request.Status !== 'REQUESTED') throw new Error('Đề nghị này không còn ở trạng thái chờ duyệt.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).updateById('ReopenRequestID', requestId, {
    Status: 'APPROVED', ApprovedByUserID: actingUser.UserID, ApprovedAt: nowIso(), UpdatedAt: nowIso()
  });

  getSheetRepository(SHEETS.ATTENDANCE_PERIODS).updateById('AttendancePeriodID', request.AttendancePeriodID, {
    Status: 'DEPT_COMPLETED', UpdatedAt: nowIso()
  });
  const attendanceRepo = getSheetRepository(SHEETS.ATTENDANCE);
  attendanceRepo.findAll().filter(function (a) { return a.AttendancePeriodID === request.AttendancePeriodID; })
    .forEach(function (a) { attendanceRepo.updateById('AttendanceID', a.AttendanceID, { Status: 'OPEN', UpdatedAt: nowIso() }); });

  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_REOPEN_APPROVED', 'AttendancePeriod', request.AttendancePeriodID, '');
  return updated;
}

function rejectReopenAttendancePeriod(actingUser, requestId, reason) {
  const request = getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).findById('ReopenRequestID', requestId);
  if (!request) throw new Error('Không tìm thấy đề nghị mở lại.');
  requirePermission(actingUser, '*', 'CanReject', 'ATTENDANCE');
  if (request.Status !== 'REQUESTED') throw new Error('Đề nghị này không còn ở trạng thái chờ duyệt.');

  const updated = getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).updateById('ReopenRequestID', requestId, {
    Status: 'REJECTED', RejectedByUserID: actingUser.UserID, RejectedAt: nowIso(), RejectionReason: reason || '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ATTENDANCE_PERIOD_REOPEN_REJECTED', 'AttendancePeriod', request.AttendancePeriodID, reason || '');
  return updated;
}

function listPendingAttendancePeriodReopenRequests(user) {
  return getSheetRepository(SHEETS.ATTENDANCE_PERIOD_REOPEN_REQUESTS).findAll()
    .filter(function (r) { return r.Status === 'REQUESTED' && hasPermission(user, '*', 'CanLock', 'ATTENDANCE'); });
}
