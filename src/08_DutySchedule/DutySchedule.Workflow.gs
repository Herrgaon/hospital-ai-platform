// Quy trình duyệt/công bố Lịch trực tuần — trạng thái riêng (không dùng lại engine 08_Workflow cũ,
// đã xoá vì gắn chặt vào Document và không khớp state machine 6 trạng thái ở đây):
// DRAFT -> SUBMITTED -> UNDER_REVIEW -> (NEED_REVISION -> DRAFT lại) -> APPROVED -> PUBLISHED.

function submitDutySchedule(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanSubmit');
  if (DUTY_SCHEDULE_EDITABLE_STATUSES_.indexOf(schedule.Status) === -1) {
    throw new Error('Chỉ có thể gửi duyệt lịch trực đang ở trạng thái Nháp hoặc Yêu cầu chỉnh sửa.');
  }
  if (listDutyShiftsBySchedule(dutyScheduleId).length === 0) {
    throw new Error('Lịch trực chưa có ca trực nào, không thể gửi duyệt.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'SUBMITTED', SubmittedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_SUBMITTED', 'DutySchedule', dutyScheduleId, schedule.WeekStartDate);
  notifyApprovers(actingUser, schedule.DepartmentID, 'Lịch trực tuần cần duyệt: ' + schedule.WeekStartDate,
    'Khoa/Phòng: ' + schedule.DepartmentID + '\nTuần: ' + schedule.WeekStartDate);
  return updated;
}

function markDutyScheduleUnderReview(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanApprove');
  if (schedule.Status !== 'SUBMITTED') throw new Error('Chỉ có thể bắt đầu xét duyệt lịch trực đang ở trạng thái Đã gửi duyệt.');

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'UNDER_REVIEW', ReviewedByUserID: actingUser.UserID, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_REVIEW_STARTED', 'DutySchedule', dutyScheduleId, '');
  return updated;
}

function requestDutyScheduleRevision(actingUser, dutyScheduleId, comment) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanReject');
  if (['SUBMITTED', 'UNDER_REVIEW'].indexOf(schedule.Status) === -1) {
    throw new Error('Chỉ có thể yêu cầu chỉnh sửa lịch trực đang chờ duyệt.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'NEED_REVISION', ReviewComment: comment || '', ReviewedByUserID: actingUser.UserID, ReviewedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_REVISION_REQUESTED', 'DutySchedule', dutyScheduleId, comment || '');
  notifyUser(schedule.CreatedByUserID, 'Lịch trực tuần cần chỉnh sửa: ' + schedule.WeekStartDate, comment || '');
  return updated;
}

function approveDutySchedule(actingUser, dutyScheduleId, comment) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanApprove');
  if (['SUBMITTED', 'UNDER_REVIEW'].indexOf(schedule.Status) === -1) {
    throw new Error('Chỉ có thể duyệt lịch trực đang chờ duyệt.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'APPROVED', ReviewComment: comment || schedule.ReviewComment, ApprovedByUserID: actingUser.UserID, ApprovedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_APPROVED', 'DutySchedule', dutyScheduleId, comment || '');
  notifyUser(schedule.CreatedByUserID, 'Lịch trực tuần đã được duyệt: ' + schedule.WeekStartDate, 'Đang chờ công bố.');
  return updated;
}

function publishDutySchedule(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanPublish');
  if (schedule.Status !== 'APPROVED') throw new Error('Chỉ có thể công bố lịch trực đã được duyệt.');

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'PUBLISHED', PublishedByUserID: actingUser.UserID, PublishedAt: nowIso(), UpdatedAt: nowIso()
  });

  const shiftsRepo = getSheetRepository(SHEETS.DUTY_SHIFTS);
  const employeeIdsNotified = {};
  listDutyShiftsBySchedule(dutyScheduleId).forEach(function (shift) {
    shiftsRepo.updateById('DutyShiftID', shift.DutyShiftID, { Status: 'OFFICIAL', UpdatedAt: nowIso() });
    if (!employeeIdsNotified[shift.EmployeeID]) {
      employeeIdsNotified[shift.EmployeeID] = true;
      const employee = getEmployeeById(shift.EmployeeID);
      if (employee) notifyUser(employee.UserID, 'Lịch trực tuần đã công bố: ' + schedule.WeekStartDate, 'Vui lòng kiểm tra ca trực của bạn trong tuần.');
    }
  });

  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_PUBLISHED', 'DutySchedule', dutyScheduleId, schedule.WeekStartDate);
  return updated;
}
