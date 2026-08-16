// Quy trình duyệt/công bố Lịch trực tuần — trạng thái riêng (không dùng lại engine 08_Workflow cũ,
// đã xoá vì gắn chặt vào Document và không khớp state machine ở đây):
// DRAFT -> SUBMITTED -> UNDER_REVIEW -> PENDING_DIRECTOR_APPROVAL -> (NEED_REVISION -> DRAFT lại) ->
// APPROVED -> PUBLISHED.
//
// 2026-08-15: tách "KH-NV kiểm tra" và "Lãnh đạo phê duyệt" thành 2 bước riêng theo đúng §23 đặc tả
// KPI + Quản lý Trực V1 (trước đó gộp chung 1 bước approveDutySchedule) — Phòng KH-NV kiểm tra xong
// CHUYỂN TIẾP cho Ban Giám Đốc, không tự quyết định thay lãnh đạo.

function submitDutySchedule(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanSubmit', 'DUTY_SCHEDULE');
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
    'Khoa/Phòng: ' + schedule.DepartmentID + '\nTuần: ' + schedule.WeekStartDate, 'DUTY_SCHEDULE');
  return updated;
}

function markDutyScheduleUnderReview(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanApprove', 'DUTY_SCHEDULE');
  if (schedule.Status !== 'SUBMITTED') throw new Error('Chỉ có thể bắt đầu xét duyệt lịch trực đang ở trạng thái Đã gửi duyệt.');

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'UNDER_REVIEW', ReviewedByUserID: actingUser.UserID, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_REVIEW_STARTED', 'DutySchedule', dutyScheduleId, '');
  return updated;
}

// Phòng KH-NV kiểm tra xong, KHÔNG tự quyết — chuyển tiếp cho Ban Giám Đốc phê duyệt chính thức.
function forwardDutyScheduleForDirectorApproval(actingUser, dutyScheduleId, comment) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanApprove', 'DUTY_SCHEDULE');
  if (['SUBMITTED', 'UNDER_REVIEW'].indexOf(schedule.Status) === -1) {
    throw new Error('Chỉ có thể chuyển lãnh đạo phê duyệt khi lịch trực đang chờ Phòng KH-NV kiểm tra.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'PENDING_DIRECTOR_APPROVAL', ReviewComment: comment || schedule.ReviewComment,
    ReviewedByUserID: actingUser.UserID, ReviewedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_FORWARDED_TO_DIRECTOR', 'DutySchedule', dutyScheduleId, comment || '');
  return updated;
}

// Callable từ cả 3 trạng thái chờ (SUBMITTED/UNDER_REVIEW/PENDING_DIRECTOR_APPROVAL) — Phòng KH-NV
// (CanReject theo khoa/phòng hoặc toàn viện) hoặc Ban Giám Đốc (CanReject toàn viện, xem
// Bootstrap.Defaults.gs) đều có thể trả lịch về Khoa để chỉnh sửa.
function requestDutyScheduleRevision(actingUser, dutyScheduleId, comment) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanReject', 'DUTY_SCHEDULE');
  if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING_DIRECTOR_APPROVAL'].indexOf(schedule.Status) === -1) {
    throw new Error('Chỉ có thể yêu cầu chỉnh sửa lịch trực đang chờ duyệt.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'NEED_REVISION', ReviewComment: comment || '', ReviewedByUserID: actingUser.UserID, ReviewedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_REVISION_REQUESTED', 'DutySchedule', dutyScheduleId, comment || '');
  notifyUser(schedule.CreatedByUserID, 'Lịch trực tuần cần chỉnh sửa: ' + schedule.WeekStartDate, comment || '');
  return updated;
}

// Phê duyệt CHÍNH THỨC — CỐ Ý kiểm tra thẳng Role thay vì requirePermission theo Department, vì đây
// là thẩm quyền của LÃNH ĐẠO (Ban Giám Đốc), không phải quyền quản lý nghiệp vụ theo khoa/phòng — đúng
// §23 "LÃNH ĐẠO PHÊ DUYỆT" là bước tách biệt khỏi "PHÒNG KH-NV KIỂM TRA".
function approveDutyScheduleByDirector(actingUser, dutyScheduleId, comment) {
  if (actingUser.Role !== ROLE_NAMES.BAN_GIAM_DOC && actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Ban Giám Đốc được phê duyệt chính thức lịch trực.');
  }
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  if (schedule.Status !== 'PENDING_DIRECTOR_APPROVAL') {
    throw new Error('Chỉ có thể phê duyệt lịch trực đã được Phòng KH-NV chuyển lên.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SCHEDULES).updateById('DutyScheduleID', dutyScheduleId, {
    Status: 'APPROVED', ApprovedByUserID: actingUser.UserID, ApprovedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SCHEDULE_APPROVED', 'DutySchedule', dutyScheduleId, comment || '');
  notifyUser(schedule.CreatedByUserID, 'Lịch trực tuần đã được lãnh đạo phê duyệt: ' + schedule.WeekStartDate, 'Đang chờ Phòng KH-NV công bố.');
  return updated;
}

function publishDutySchedule(actingUser, dutyScheduleId) {
  const schedule = getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', dutyScheduleId);
  if (!schedule) throw new Error('Không tìm thấy lịch trực.');
  requirePermission(actingUser, schedule.DepartmentID, 'CanPublish', 'DUTY_SCHEDULE');
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
