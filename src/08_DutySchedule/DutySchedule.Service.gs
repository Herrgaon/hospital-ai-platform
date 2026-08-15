// Lịch trực tuần — module trọng tâm Giai đoạn 1. CRUD ca trực chỉ hợp lệ khi lịch còn DRAFT hoặc
// NEED_REVISION; mọi thay đổi trên lịch đã PUBLISHED (chính thức) phải đi qua Đổi trực
// (DutySchedule.Swap.gs), không sửa trực tiếp — xem DutySchedule.Workflow.gs cho quy trình duyệt.

const DUTY_SCHEDULE_EDITABLE_STATUSES_ = ['DRAFT', 'NEED_REVISION'];

function requireDutyScheduleEditable_(schedule) {
  if (DUTY_SCHEDULE_EDITABLE_STATUSES_.indexOf(schedule.Status) === -1) {
    throw new Error('Không thể sửa lịch trực đã gửi duyệt/công bố — dùng chức năng Đổi trực.');
  }
}

function hasOverlappingShift_(employeeId, shiftDate, shiftStart, shiftEnd, excludeShiftId) {
  return getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().some(function (s) {
    if (s.Status === 'CANCELLED' || s.Status === 'SWAPPED_OUT' || s.DutyShiftID === excludeShiftId) return false;
    if (s.EmployeeID !== employeeId || s.ShiftDate !== shiftDate) return false;
    return shiftStart < s.ShiftEnd && s.ShiftStart < shiftEnd;
  });
}

function createDutySchedule(actingUser, departmentId, weekStartDate, weekEndDate) {
  requirePermission(actingUser, departmentId, 'CanCreate');
  const duplicate = getSheetRepository(SHEETS.DUTY_SCHEDULES).findAll().find(function (s) {
    return s.DepartmentID === departmentId && s.WeekStartDate === weekStartDate;
  });
  if (duplicate) throw new Error('Đã tồn tại lịch trực cho khoa/phòng này trong tuần đã chọn.');

  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).append({
    DutyScheduleID: generateId('DSCH'),
    DepartmentID: departmentId,
    WeekStartDate: weekStartDate,
    WeekEndDate: weekEndDate,
    Status: 'DRAFT',
    CreatedByUserID: actingUser.UserID,
    SubmittedAt: '', ReviewedByUserID: '', ReviewComment: '', ReviewedAt: '',
    ApprovedByUserID: '', ApprovedAt: '', PublishedByUserID: '', PublishedAt: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_CREATED', 'DutySchedule', schedule.DutyScheduleID, weekStartDate);
  return schedule;
}

function addDutyShift(actingUser, dutyScheduleId, input) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanEdit');
  requireDutyScheduleEditable_(schedule);

  const employee = getEmployeeById(input.employeeId);
  if (!employee || employee.Status !== 'Active') {
    throw new Error('Không thể xếp trực cho nhân viên đã nghỉ việc/ngừng hoạt động.');
  }
  if (hasOverlappingShift_(input.employeeId, input.shiftDate, input.shiftStart, input.shiftEnd, null)) {
    throw new Error('Nhân viên đã có ca trực trùng thời gian trong ngày này.');
  }

  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).append({
    DutyShiftID: generateId('DSHF'),
    DutyScheduleID: dutyScheduleId,
    DepartmentID: schedule.DepartmentID,
    ShiftDate: input.shiftDate,
    DutyType: input.dutyType,
    EmployeeID: input.employeeId,
    RoleInShift: input.roleInShift || '',
    ShiftStart: input.shiftStart,
    ShiftEnd: input.shiftEnd,
    AssignedByUserID: actingUser.UserID,
    Status: 'PLANNED',
    OriginatingSwapRequestID: '',
    Notes: input.notes || '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SHIFT_ADDED', 'DutyShift', shift.DutyShiftID, input.shiftDate + ' ' + input.dutyType);
  return shift;
}

function updateDutyShift(actingUser, dutyShiftId, patch) {
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', dutyShiftId);
  if (!shift) throw new Error('Không tìm thấy ca trực.');
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', shift.DutyScheduleID);
  requirePermission(actingUser, shift.DepartmentID, 'CanEdit');
  requireDutyScheduleEditable_(schedule);

  const updated = getSheetRepository(SHEETS.DUTY_SHIFTS).updateById('DutyShiftID', dutyShiftId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  logAudit(actingUser.UserID, 'DUTY_SHIFT_UPDATED', 'DutyShift', dutyShiftId, JSON.stringify(patch));
  return updated;
}

function removeDutyShift(actingUser, dutyShiftId) {
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', dutyShiftId);
  if (!shift) throw new Error('Không tìm thấy ca trực.');
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', shift.DutyScheduleID);
  requirePermission(actingUser, shift.DepartmentID, 'CanEdit');
  requireDutyScheduleEditable_(schedule);

  getSheetRepository(SHEETS.DUTY_SHIFTS).updateById('DutyShiftID', dutyShiftId, { Status: 'CANCELLED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'DUTY_SHIFT_REMOVED', 'DutyShift', dutyShiftId, '');
  return { success: true };
}

function listDutyShiftsBySchedule(dutyScheduleId) {
  return getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) {
    return s.DutyScheduleID === dutyScheduleId && s.Status !== 'CANCELLED';
  });
}

function listDutySchedulesByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.DUTY_SCHEDULES).findAll().filter(function (s) { return s.DepartmentID === departmentId; });
}

// Cảnh báo xung đột KHÔNG chặn thao tác (đúng §22 đặc tả: "cảnh báo không đồng nghĩa tự động từ
// chối") — chỉ hiển thị để Trưởng khoa/KH-NV tự cân nhắc trước khi gửi duyệt. Hiện phủ 1 loại cảnh
// báo khả thi (nhân viên ngoài khoa được phân công); các loại khác (vị trí bắt buộc thiếu người, ca
// chưa đủ nhân sự) cần khái niệm "định biên theo vị trí" chưa có trong V1, để lại cho giai đoạn sau.
function getDutyScheduleWarnings_(schedule, shifts) {
  const warnings = [];
  shifts.forEach(function (shift) {
    const employee = getEmployeeById(shift.EmployeeID);
    if (employee && employee.DepartmentID !== schedule.DepartmentID) {
      warnings.push({
        type: 'OUTSIDE_DEPARTMENT', dutyShiftId: shift.DutyShiftID,
        message: (employee.FullName || shift.EmployeeID) + ' không thuộc khoa/phòng này (ngày ' + shift.ShiftDate + ').'
      });
    }
  });
  return warnings;
}

function getDutyScheduleDetail(user, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(user, schedule.DepartmentID, 'CanView');
  const shifts = listDutyShiftsBySchedule(dutyScheduleId);
  return { schedule: schedule, shifts: shifts, warnings: getDutyScheduleWarnings_(schedule, shifts) };
}

function listMyDutyShifts(user, dateFrom, dateTo) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) {
    if (s.Status === 'CANCELLED' || s.EmployeeID !== employee.EmployeeID) return false;
    if (dateFrom && s.ShiftDate < dateFrom) return false;
    if (dateTo && s.ShiftDate > dateTo) return false;
    return true;
  });
}

// BGĐ/Phòng KH-NV/SUPER_ADMIN có quyền CanView phạm vi '*' nên requirePermission(user, '*', ...) sẽ
// đúng cho vai trò toàn viện; người khác gọi hàm này sẽ bị từ chối đúng như thiết kế (chỉ xem được
// lịch của khoa mình qua listDutySchedulesByDepartment).
function listHospitalWideDutySchedules(user, weekStartDate) {
  requirePermission(user, '*', 'CanView');
  return getSheetRepository(SHEETS.DUTY_SCHEDULES).findAll().filter(function (s) {
    return !weekStartDate || s.WeekStartDate === weekStartDate;
  });
}
